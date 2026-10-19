# Intérprete Prolog con agente de IA

Aplicación web (Unidad III · Programación Lógica) donde se pega código Prolog + una consulta `?- ...`, se envía al agente y se muestra **"Esta es la respuesta: ..."** con una explicación.

## Arquitectura
- **Motor**: [Tau Prolog](http://tau-prolog.org/) (incluido en `public/js/vendor/`) ejecuta el código en el navegador → resultado exacto.
- **Agente de IA**: `api/explain.js` (función serverless) llama a Gemini para explicar el razonamiento. La API key nunca llega al navegador.
- **Respaldo**: si la IA no está disponible, `public/js/local-explainer.js` genera una explicación local.

## Estructura
```
public/        # sitio estático (index.html, css, js)
api/explain.js # función serverless (Gemini)
dev-server.js  # servidor local de desarrollo
```

## Ejecutar local
```bash
node dev-server.js        # http://localhost:3000
npm test                  # pruebas del motor
```
Para activar la IA crea un archivo `.env` con `GEMINI_API_KEY=tu_clave` (gratis en https://aistudio.google.com/apikey).

## Publicar en Vercel
```bash
npx vercel env add GEMINI_API_KEY production
npx vercel deploy --prod
```
