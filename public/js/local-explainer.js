/* Explicador local (respaldo cuando la IA generativa no está disponible).
   Analiza el programa de forma heurística y describe cómo Prolog llegó al resultado. */
(function (root) {
  "use strict";

  function stripComments(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/%.*$/gm, "");
  }

  /** Divide el programa en cláusulas (termina en "." seguido de espacio o fin) */
  function clauses(program) {
    const src = stripComments(program);
    const out = [];
    let buf = "";
    let quote = null;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      buf += c;
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === "'" || c === '"') { quote = c; continue; }
      if (c === "." && (i + 1 >= src.length || /\s/.test(src[i + 1])) && !/\d$/.test(buf.slice(0, -1))) {
        const t = buf.trim();
        if (t.length > 1) out.push(t.replace(/\s+/g, " "));
        buf = "";
      }
    }
    return out;
  }

  function headName(clause) {
    const m = clause.match(/^\s*([a-z][A-Za-z0-9_]*)\s*(\(|:-|\.|$)/);
    return m ? m[1] : null;
  }

  function goalNames(query) {
    const names = new Set();
    const re = /\b([a-z][A-Za-z0-9_]*)\s*\(/g;
    let m;
    while ((m = re.exec(query))) names.add(m[1]);
    return [...names];
  }

  const BUILTINS = new Set(["is", "findall", "once", "length", "write", "nl", "member", "append", "bagof", "setof", "not", "atom", "number", "var", "nonvar", "sqrt", "max", "min", "abs", "mod", "msort", "sort", "reverse", "nth0", "nth1", "sum_list", "forall", "between"]);

  function explain(program, qResult) {
    const cls = clauses(program);
    const lines = [];
    const g = qResult.goal.replace(/\.$/, "");
    const isErr = qResult.status === "error" && qResult.solutions.length === 0;

    // Predicados de la consulta definidos por el usuario
    const names = goalNames(g).filter((n) => !BUILTINS.has(n));
    for (const n of names) {
      const related = cls.filter((c) => headName(c) === n);
      if (!related.length) continue;
      const facts = related.filter((c) => !c.includes(":-")).length;
      const rules = related.length - facts;
      lines.push(
        `El predicado **${n}** tiene ${related.length} cláusula(s)` +
          (facts ? `: ${facts} hecho(s)` : "") + (rules ? `${facts ? " y" : ":"} ${rules} regla(s)` : "") +
          ". Prolog las prueba **en orden, de arriba hacia abajo**, unificando los argumentos de la consulta con la cabeza de cada cláusula."
      );
    }

    // Características detectadas
    // Solo se analizan las cláusulas alcanzables desde la consulta
    const reach = new Set(names);
    const queue = [...names];
    const relevant = [];
    while (queue.length) {
      const n = queue.shift();
      for (const c of cls.filter((c) => headName(c) === n)) {
        relevant.push(c);
        for (const m of goalNames(c.replace(/^[^:]*:-/, "")).concat(
          (c.replace(/^[^:]*:-/, "").match(/\b[a-z][A-Za-z0-9_]*\b/g) || [])
        )) {
          if (!reach.has(m) && cls.some((x) => headName(x) === m)) { reach.add(m); queue.push(m); }
        }
      }
    }
    const body = relevant.join(" ") + " " + g;
    if (/!/.test(body))
      lines.push("**Corte (`!`)**: al ejecutarse, Prolog descarta las alternativas pendientes del predicado actual: ya no reintenta las cláusulas siguientes ni los puntos de elección anteriores dentro de esa cláusula.");
    if (/\\\+|\bnot\(/.test(body))
      lines.push("**Negación como fallo (`\\+`)**: `\\+ G` tiene éxito cuando Prolog **no logra demostrar** `G`. No significa que `G` sea falso en el mundo real, solo que no se puede probar con el programa (hipótesis del mundo cerrado).");
    if (/;/.test(body))
      lines.push("**Disyunción (`;`)**: significa «o». Prolog prueba el lado izquierdo y, si falla (o al pedir más soluciones), prueba el derecho.");
    if (/->/.test(body))
      lines.push("**Si-entonces-sino (`->`)**: si la condición tiene éxito se ejecuta la rama «entonces» (sin reintentar la condición); si falla, la rama «sino».");
    if (/\bis\b/.test(body))
      lines.push("**Aritmética (`is`)**: evalúa la expresión del lado derecho y unifica el resultado con la variable izquierda. El lado derecho debe estar completamente instanciado.");
    if (/\[[^\]]*\|[^\]]*\]/.test(body))
      lines.push("**Listas**: el patrón `[H|T]` separa la **cabeza** (primer elemento) de la **cola** (resto de la lista). La recursión sobre `T` recorre la lista.");
    if (/\bfindall\b|\bbagof\b|\bsetof\b/.test(body))
      lines.push("**findall/bagof/setof**: recolectan en una lista todas las soluciones de un objetivo.");

    // Resultado
    if (isErr) {
      lines.push(`La consulta **no pudo completarse**: ${qResult.error}`);
    } else if (qResult.status === "false") {
      lines.push("Prolog agotó todas las alternativas sin lograr demostrar la consulta, por lo que responde **false**.");
    } else {
      const vars = /\b[A-Z_][A-Za-z0-9_]*\b/.test(g.replace(/'[^']*'/g, ""));
      if (!qResult.solutions.length || (qResult.solutions.length === 1 && qResult.solutions[0] === "true")) {
        lines.push("Prolog encontró una forma de demostrar la consulta sin necesidad de asignar valores a variables: responde **true**.");
      } else if (qResult.solutions.length === 1) {
        lines.push(`Prolog encontró una solución y las variables quedaron ligadas así: \`${qResult.solutions[0]}\`.`);
      } else {
        lines.push(`Mediante **backtracking**, Prolog encontró ${qResult.solutions.length} soluciones${qResult.truncated ? " (se muestran las primeras)" : ""}; cada una se obtiene retrocediendo y probando la siguiente cláusula aplicable.`);
      }
      if (!vars && !lines.length) lines.push("La consulta no tiene variables, así que solo se verifica si es verdadera o falsa.");
    }
    if (qResult.output) lines.push(`El programa además escribió en la salida: \`${qResult.output.trim()}\`.`);
    return lines;
  }

  root.LocalExplainer = { explain, clauses };
})(typeof self !== "undefined" ? self : this);
