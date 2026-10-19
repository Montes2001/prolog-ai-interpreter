/**
 * Función serverless (Vercel / Netlify-compatible estilo Vercel).
 * Recibe { program, queries: [{goal, response}] } y devuelve { explanation } generada por Gemini.
 * La API key vive en la variable de entorno GEMINI_API_KEY (nunca llega al navegador).
 */
const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const SYSTEM_PROMPT = `Eres un profesor experto en Prolog (programación lógica) que ayuda a estudiantes universitarios.
Se te da un programa Prolog, una consulta y el RESULTADO REAL obtenido al ejecutarlo con un intérprete.
Tu tarea es EXPLICAR en español, de forma clara y breve (máximo 8 líneas por consulta), por qué se obtiene ese resultado.
Reglas:
- NO cambies ni discutas el resultado: es correcto, ya fue ejecutado.
- Explica paso a paso: qué cláusulas se prueban, cómo ocurre la unificación, el backtracking y las alternativas.
- Si hay corte (!), negación como fallo (\\+), disyunción (;), if-then-else (->), aritmética (is) o listas ([H|T]), explica su efecto concreto en ESTA ejecución.
- Usa Markdown simple: listas con "-" y código entre comillas invertidas. No uses encabezados.
- No repitas el código completo.`;

module.exports = async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: "Método no permitido" }));
  }
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ error: "GEMINI_API_KEY no configurada" }));
  }

  try {
    let body = req.body;
    if (!body) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    } else if (typeof body === "string") {
      body = JSON.parse(body);
    }
    const program = String(body.program || "").slice(0, 8000);
    const queries = Array.isArray(body.queries) ? body.queries.slice(0, 8) : [];
    if (!queries.length) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: "Sin consultas" }));
    }

    const userText =
      `PROGRAMA:\n\`\`\`prolog\n${program}\n\`\`\`\n\n` +
      queries
        .map((q, i) => `CONSULTA ${i + 1}: ?- ${String(q.goal).slice(0, 500)}\nRESULTADO REAL: ${String(q.response).slice(0, 1500)}`)
        .join("\n\n") +
      `\n\nResponde con una sección por consulta, comenzando cada una con "**Consulta N:**".`;

    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1500, thinkingConfig: { thinkingBudget: 0 } },
        }),
      }
    );
    if (!r.ok) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: "Error del proveedor de IA (" + r.status + ")" }));
    }
    const data = await r.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim();
    if (!text) {
      res.statusCode = 502;
      return res.end(JSON.stringify({ error: "Respuesta vacía de la IA" }));
    }
    res.statusCode = 200;
    return res.end(JSON.stringify({ explanation: text, model: MODEL }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: "Error interno" }));
  }
};
