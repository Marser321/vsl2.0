# Brief: Importador de transcripts de YouTube en el Analizador — VSL Studio

> **Para el agente ejecutor (GPT/Codex):** brief autocontenido; no tenés acceso a la conversación que lo originó. Leé COMPLETA la sección "Restricciones técnicas" antes de tocar código. Esfuerzo estimado: bajo — la mitad del código ya existe.

## Contexto

VSL Studio (Next.js 16 App Router + Tailwind 4 + Drizzle/Postgres) tiene un **Analizador de VSLs** en `/analizador` (`src/app/analizador/page.tsx`): el usuario pega a mano el transcript de un VSL de la competencia en un `<textarea name="transcript">`, y el endpoint `POST /api/analyze` lo analiza con IA por streaming SSE y guarda el resultado en la biblioteca.

**Lo que falta:** poder pegar una URL de YouTube (o Vimeo) y que la app extraiga el transcript sola. La extracción **ya existe** y funciona: `src/lib/ingest/url.ts` exporta `extractPublicUrl(url)`, que para hosts de video (`youtube.com`, `youtu.be`, `*.youtube.com`, `vimeo.com`, `*.vimeo.com`) busca los `captionTracks` en el HTML, prefiere pista en español, descarga los captions y devuelve `{ title, text, finalUrl, contentType, needsInput, metadata }`. Cuando no hay captions, devuelve `needsInput: true` y `metadata.transcript === "unavailable"`. Incluye defensa anti-SSRF (`assertPublicUrl`), límite de 2 MB y timeout de 10 s. **No modifiques ese archivo.**

## Qué construir

### 1. Endpoint `POST /api/analyze/import-url`

Crear `src/app/api/analyze/import-url/route.ts`:

- Body validado con Zod: `{ url: z.string().url().max(2000) }`.
- Guarda de auth como TODOS los endpoints del panel: `const guard = await guardAdminRequest(req, true); if (guard) return guard;` (importar de `@/lib/auth/session`; el segundo argumento `true` activa el chequeo same-origin para mutaciones — usalo aunque esto sea una lectura, es la convención para POST).
- Llamar `extractPublicUrl(url)` (import de `@/lib/ingest/url`).
- Si `result.metadata.video === true` y `result.needsInput === true` → `400` con `{ error: "El video no tiene subtítulos públicos. Pegá el transcript a mano." }`.
- Si el texto útil quedó vacío → `400` con error claro.
- Respuesta `200`: `{ title, text, metadata }` (el `text` de `extractPublicUrl` ya viene como `Título: …\n\nDescripción: …\n\nTranscript: …` — servilo tal cual; el analizador se beneficia del título y descripción como contexto).
- Errores de `extractPublicUrl` (URL privada, tipo no soportado, límite de tamaño): responder `400` con el `message` de la excepción (los mensajes ya están en español).
- `export const maxDuration = 30;`

No hace falta restringir a hosts de video: si el usuario pega un artículo, `extractPublicUrl` devuelve el texto de la página y también sirve como material de análisis. Dejalo pasar.

### 2. UI en `src/app/analizador/page.tsx`

Encima del textarea de transcript, agregar una fila "Importar desde URL":

- `Input` de URL + botón secundario "Importar transcript" (estilos del design system: `inputCls`/`btnSecondary` de `@/components/ui`, o los componentes `Input`/`Button` si ya existe `src/components/ui/` — mirá qué hay al momento de ejecutar).
- Al click: estado `importing` (botón deshabilitado con texto "Importando…"), `fetch("/api/analyze/import-url", { method: "POST", ... })`.
- Éxito: volcar `text` al textarea de transcript y, si el campo título está vacío, volcar `title` al input `name="title"`. Como el form usa campos no controlados (`FormData` en el submit), la forma más simple es guardar el transcript importado en un estado `importedTranscript` y usarlo como `defaultValue`/`value` controlado del textarea — elegí UNA estrategia y mantené el submit actual funcionando (`fd.get("transcript")` debe seguir devolviendo el contenido).
- Error: mostrar el mensaje en el mismo banner de error rojo que ya existe en la página (estado `error`).
- El flujo manual (pegar a mano) debe seguir funcionando exactamente igual.

## Restricciones técnicas (LEER PRIMERO)

- **Next.js 16.2.10** — difiere de tu entrenamiento. Ante dudas leé `node_modules/next/dist/docs/`. Claves: `params` es Promise (`await params`); middleware = `src/proxy.ts` (no crear `middleware.ts`); no hay `next lint` — verificá con `npm run build` y `npx tsc --noEmit`; Turbopack default, sin config webpack.
- **Tailwind 4 CSS-first**: no existe `tailwind.config.*`; tokens en `src/app/globals.css`.
- Zod v4 ya está en el proyecto; validá SIEMPRE el body.
- Textos de UI en español rioplatense (voseo).
- Sin dependencias nuevas.

## NO TOCAR

- `src/lib/ingest/url.ts` (la extracción ya está probada — solo consumila).
- `src/app/api/analyze/route.ts` (el análisis streaming queda igual).
- `src/db/**`, `drizzle/**`, `src/proxy.ts`, `src/lib/ai/**`.

## Criterios de aceptación

1. `npx tsc --noEmit`, `npm run build`, `npm test` en verde.
2. En `/analizador`: pegar la URL de un video de YouTube con subtítulos → el textarea se llena con título/descripción/transcript y el análisis corre normal.
3. URL de video sin subtítulos → banner de error claro, sin romper la página.
4. URL inválida o de red privada (`http://localhost/x`) → error 400 controlado (la defensa ya está en `assertPublicUrl`).
5. El flujo de pegar transcript a mano sigue intacto.
6. El endpoint responde 401 sin sesión cuando `REQUIRE_AUTH=true` (lo da `guardAdminRequest` solo).

## Verificación manual

`npm run dev` → `/analizador` → importar una URL de YouTube real con captions en español (ej. cualquier charla TED en español) → verificar textarea lleno → "Analizar VSL" → streaming OK → link "Guardado en la biblioteca". Probar también una URL de un artículo y una URL sin captions.
