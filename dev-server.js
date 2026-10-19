// Servidor local de desarrollo: sirve archivos estáticos y /api/explain.
// Uso: node server.js   (opcional: archivo .env con GEMINI_API_KEY=...)
const http = require("http");
const fs = require("fs");
const path = require("path");

try {
  for (const l of fs.readFileSync(path.join(__dirname, ".env"), "utf8").split(/\r?\n/)) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch (e) {}

const explain = require("./api/explain.js");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon" };
const PORT = process.env.PORT || 3000;

http
  .createServer((req, res) => {
    const url = decodeURIComponent(req.url.split("?")[0]);
    if (url === "/api/explain") return explain(req, res);
    const ROOT = path.join(__dirname, "public");
    let file = path.join(ROOT, url === "/" ? "index.html" : url);
    if (!file.startsWith(ROOT)) {
      res.statusCode = 403;
      return res.end("Forbidden");
    }
    fs.readFile(file, (err, data) => {
      if (err) { res.statusCode = 404; return res.end("Not found"); }
      res.setHeader("Content-Type", TYPES[path.extname(file)] || "application/octet-stream");
      res.end(data);
    });
  })
  .listen(PORT, () => console.log(`http://localhost:${PORT}`));
