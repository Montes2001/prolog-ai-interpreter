/* Motor Prolog: envuelve Tau Prolog (funciona en navegador y en Node para pruebas) */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./vendor/tau-prolog.js"));
  } else {
    root.PrologEngine = factory(root.pl);
  }
})(typeof self !== "undefined" ? self : this, function (pl) {
  "use strict";

  const MAX_SOLUTIONS = 50;
  const INFERENCE_LIMIT = 200000;

  /** Separa el texto del usuario en programa y consultas (?- ... .) */
  function splitInput(text) {
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    const program = [];
    const queries = [];
    let current = null;
    for (const line of lines) {
      if (current !== null) {
        current += " " + line.trim();
        if (/\.\s*(%.*)?$/.test(line)) {
          queries.push(cleanQuery(current));
          current = null;
        }
        continue;
      }
      const m = line.match(/^\s*\?-\s*(.*)$/);
      if (m) {
        if (/\.\s*(%.*)?$/.test(m[1])) queries.push(cleanQuery(m[1]));
        else current = m[1].trim();
      } else {
        program.push(line);
      }
    }
    if (current !== null) queries.push(cleanQuery(current));
    return { program: program.join("\n"), queries };
  }

  function cleanQuery(q) {
    q = q.replace(/\s+%.*$/, "").trim();
    if (!/\.$/.test(q)) q += ".";
    return q;
  }

  function promisifyAnswer(session) {
    return new Promise((resolve) => {
      session.answer({
        success: (a) => resolve({ type: "success", answer: a }),
        fail: () => resolve({ type: "fail" }),
        error: (e) => resolve({ type: "error", error: e }),
        limit: () => resolve({ type: "limit" }),
      });
    });
  }

  function listToArray(t) {
    const out = [];
    while (t && t.indicator === "'.'/2") { out.push(t.args[0]); t = t.args[1]; }
    return out;
  }

  /** Convierte un término de error de Tau Prolog en un mensaje en español */
  function formatError(err) {
    try {
      if (err && err.id === "throw" && err.args) err = err.args[0];
      if (!err || !err.args || err.id !== "error") return String(err);
      const formal = err.args[0];
      const ctx = err.args[1];
      const name = formal.id;
      if (name === "existence_error" && formal.args[0].id === "procedure") {
        const pi = formal.args[1];
        return `El predicado ${pi.args[0]}/${pi.args[1]} no está definido en el programa.`;
      }
      if (name === "syntax_error") {
        let where = "";
        const info = listToArray(ctx);
        const line = info.find((x) => x.id === "line");
        const col = info.find((x) => x.id === "column");
        if (line && ctx) where = ` (línea ${Math.max(1, Number(line.args[0].value) - 1)}${col ? ", columna " + col.args[0].value : ""})`;
        return "Error de sintaxis" + where + ": " + formal.args[0] + ". Revisa paréntesis, comas y el punto final de cada cláusula.";
      }
      if (name === "instantiation_error")
        return "Error de instanciación: se usó una variable sin valor donde se necesita un valor concreto (por ejemplo, en una operación aritmética).";
      if (name === "type_error")
        return `Error de tipo: se esperaba ${formal.args[0]} pero se recibió ${formal.args[1]}.`;
      if (name === "evaluation_error")
        return formal.args[0].id === "zero_divisor" ? "Error de evaluación: división entre cero." : "Error de evaluación aritmética: " + formal.args[0];
      if (name === "permission_error")
        return `Error de permiso: no se puede ${formal.args[0]} ${formal.args[1]} ${formal.args[2]} (es un predicado predefinido).`;
      return "Error: " + String(formal);
    } catch (e) {
      return String(err);
    }
  }

  function formatSolution(session, answer) {
    let s = pl.format_answer(answer, { session }).trim();
    s = s.replace(/\s*;?\s*$/, "").replace(/\.$/, "");
    return s;
  }

  /** Ejecuta programa + una consulta. Devuelve todas las soluciones. */
  async function runQuery(program, goal) {
    // Tau Prolog devuelve flotante con ** (ISO); SWI-Prolog devuelve entero para enteros.
    program = program.replace(/\*\*/g, "^");
    goal = goal.replace(/\*\*/g, "^");
    const session = pl.create(INFERENCE_LIMIT);
    let output = "";
    session.standard_output = new pl.type.Stream(
      { put: (t) => { output += t; return true; }, flush: () => true },
      "append", "user_output", "text", false, "eof_code"
    );
    session.current_output = session.standard_output;

    const result = { goal, status: "false", solutions: [], output: "", error: null, truncated: false };

    const consultErr = await new Promise((resolve) => {
      session.consult(":- use_module(library(lists)).\n" + program, { success: () => resolve(null), error: (e) => resolve(e) });
    });
    if (consultErr) {
      result.status = "error";
      result.error = formatError(consultErr);
      return result;
    }

    const qErr = await new Promise((resolve) => {
      session.query(goal, { success: () => resolve(null), error: (e) => resolve(e) });
    });
    if (qErr) {
      result.status = "error";
      result.error = formatError(qErr);
      return result;
    }

    while (result.solutions.length < MAX_SOLUTIONS) {
      const r = await promisifyAnswer(session);
      if (r.type === "success") {
        result.solutions.push(formatSolution(session, r.answer));
      } else if (r.type === "fail") {
        break;
      } else if (r.type === "limit") {
        result.status = "error";
        result.error = "Se alcanzó el límite de inferencias (posible bucle infinito o recursión sin fin).";
        break;
      } else {
        if (result.solutions.length === 0) {
          result.status = "error";
        }
        result.error = formatError(r.error);
        break;
      }
    }
    if (result.solutions.length >= MAX_SOLUTIONS) result.truncated = true;
    if (result.status !== "error") result.status = result.solutions.length ? "true" : "false";
    result.output = output;
    return result;
  }

  /** Texto "Esta es la respuesta" para una consulta */
  function formatResponse(r) {
    if (r.status === "error" && r.solutions.length === 0) return "Error — " + r.error;
    if (r.status === "false") return "false.";
    return r.solutions.map((s, i) => s + (i === r.solutions.length - 1 ? "." : " ;")).join("\n");
  }

  async function run(text) {
    const { program, queries } = splitInput(text);
    const results = [];
    for (const q of queries) results.push(await runQuery(program, q));
    return { program, queries: results };
  }

  return { run, runQuery, splitInput, formatResponse, MAX_SOLUTIONS };
});
