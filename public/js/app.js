(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const input = $("code-input");
  const sendBtn = $("send-btn");
  const clearBtn = $("clear-btn");
  const resultArea = $("result-area");
  const statusPill = $("engine-status");
  const select = $("example-select");
  const chips = $("example-chips");

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- Ejemplos ---------- */
  function loadExample(ex) {
    input.value = ex.codigo;
    [...chips.children].forEach((c) => c.classList.toggle("active", c.dataset.id === ex.id));
    select.value = ex.id;
    input.focus();
  }
  window.PROLOG_EXAMPLES.forEach((ex) => {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = ex.tema;
    select.appendChild(opt);
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.dataset.id = ex.id;
    chip.id = "chip-" + ex.id;
    chip.textContent = ex.tema;
    chip.title = ex.titulo;
    chip.addEventListener("click", () => loadExample(ex));
    chips.appendChild(chip);
  });
  select.addEventListener("change", () => {
    const ex = window.PROLOG_EXAMPLES.find((e) => e.id === select.value);
    if (ex) loadExample(ex);
  });

  /* ---------- Markdown mínimo (negritas, código, listas) ---------- */
  function inline(s) {
    return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  }
  function markdown(md) {
    const out = [];
    let inList = false;
    for (const raw of md.split("\n")) {
      const line = raw.trim();
      const li = line.match(/^[-*•]\s+(.*)$/);
      if (li) {
        if (!inList) { out.push("<ul>"); inList = true; }
        out.push("<li>" + inline(li[1]) + "</li>");
        continue;
      }
      if (inList) { out.push("</ul>"); inList = false; }
      if (line) out.push("<p>" + inline(line) + "</p>");
    }
    if (inList) out.push("</ul>");
    return out.join("");
  }

  /* ---------- Render ---------- */
  function renderQuery(r, idx) {
    const response = PrologEngine.formatResponse(r);
    const isErr = r.status === "error" && r.solutions.length === 0;
    const cls = isErr ? "err" : r.status === "true" ? "ok" : "no";
    const intro = isErr ? "Hubo un problema al ejecutar:" : "Esta es la respuesta:";
    const el = document.createElement("article");
    el.className = "qres";
    el.id = "query-result-" + idx;
    el.innerHTML = `
      <div class="qres-head"><span class="q-label">?-</span><span class="q-goal">${esc(r.goal.replace(/\.$/, ""))}.</span></div>
      <div class="answer">
        <div class="answer-intro">${intro}</div>
        <div class="answer-value ${cls}">${esc(isErr ? r.error : response)}</div>
        ${r.error && !isErr ? `<div class="notice" style="margin-top:10px">${esc(r.error)}</div>` : ""}
        ${r.truncated ? `<div class="muted">Se muestran solo las primeras ${PrologEngine.MAX_SOLUTIONS} soluciones.</div>` : ""}
        ${r.output ? `<div class="output-box"><b>Salida del programa:</b>\n${esc(r.output)}</div>` : ""}
      </div>
      <div class="explain">
        <div class="explain-head"><span class="explain-title">💡 Explicación</span><span class="tag" id="explain-tag-${idx}"></span></div>
        <div class="explain-body" id="explain-body-${idx}"><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>
      </div>`;
    return el;
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    sendBtn.classList.toggle("loading", busy);
    sendBtn.querySelector(".btn-label").textContent = busy ? "El agente está analizando…" : "Enviar al agente";
    statusPill.textContent = busy ? "Ejecutando…" : "Listo";
    statusPill.classList.toggle("busy", busy);
  }

  function localExplanation(program, q) {
    return window.LocalExplainer.explain(program, q).map((l) => "- " + l).join("\n");
  }

  async function askAI(program, queries) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch("api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program,
          queries: queries.map((q) => ({ goal: q.goal, response: PrologEngine.formatResponse(q) })),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      if (!data.explanation) throw new Error("vacío");
      return data.explanation;
    } finally {
      clearTimeout(t);
    }
  }

  /** Divide la explicación de la IA por "Consulta N:" */
  function splitByQuery(text, n) {
    if (n === 1) return [text.replace(/^\s*\*{0,2}Consulta\s+\d+\s*:?\*{0,2}:?\s*/i, "")];
    const parts = text.split(/\*{0,2}Consulta\s+\d+\s*:?\*{0,2}:?/i).map((s) => s.trim()).filter(Boolean);
    return parts.length === n ? parts : null;
  }

  async function submit() {
    const text = input.value.trim();
    if (!text) {
      resultArea.innerHTML = `<div class="notice">Escribe o pega código Prolog con una consulta (<code>?- ...</code>) antes de enviar.</div>`;
      input.focus();
      return;
    }
    setBusy(true);
    resultArea.innerHTML = "";
    try {
      await new Promise((r) => setTimeout(r, 50));
      const { program, queries } = await PrologEngine.run(text);
      if (!queries.length) {
        resultArea.innerHTML = `<div class="notice">No encontré ninguna consulta. Agrega una línea como <code>?- miembro(b, [a,b,c]).</code> al final de tu código.</div>`;
        return;
      }
      queries.forEach((q, i) => resultArea.appendChild(renderQuery(q, i)));
      resultArea.scrollIntoView({ behavior: "smooth", block: "nearest" });

      // Explicaciones: primero la local (inmediata si la IA falla), luego se intenta la IA
      const fillLocal = () =>
        queries.forEach((q, i) => {
          $("explain-body-" + i).innerHTML = markdown(localExplanation(program, q));
          const tag = $("explain-tag-" + i);
          tag.className = "tag local";
          tag.textContent = "Explicación del analizador local";
        });

      try {
        const ai = await askAI(program, queries);
        const parts = splitByQuery(ai, queries.length);
        if (parts) {
          parts.forEach((p, i) => {
            $("explain-body-" + i).innerHTML = markdown(p);
            const tag = $("explain-tag-" + i);
            tag.className = "tag ai";
            tag.textContent = "✦ Agente de IA";
          });
        } else {
          // Respuesta única para varias consultas: mostrarla completa en la primera
          $("explain-body-0").innerHTML = markdown(ai);
          $("explain-tag-0").className = "tag ai";
          $("explain-tag-0").textContent = "✦ Agente de IA";
          for (let i = 1; i < queries.length; i++) {
            $("explain-body-" + i).innerHTML = markdown("Ver la explicación conjunta en la primera consulta.");
          }
        }
      } catch (e) {
        fillLocal();
      }
    } catch (e) {
      resultArea.innerHTML = `<div class="notice">Ocurrió un error inesperado: ${esc(e.message || e)}</div>`;
    } finally {
      setBusy(false);
    }
  }

  sendBtn.addEventListener("click", submit);
  clearBtn.addEventListener("click", () => {
    input.value = "";
    chips.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    select.value = "";
    input.focus();
  });
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); submit(); }
    if (e.key === "Tab") {
      e.preventDefault();
      const s = input.selectionStart;
      input.setRangeText("    ", s, input.selectionEnd, "end");
    }
  });

  loadExample(window.PROLOG_EXAMPLES[0]);
})();
