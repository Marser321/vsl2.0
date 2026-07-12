# Brief: Reescritura guiada por mapa de retención — VSL Studio

> **Para el agente ejecutor (GPT/Codex):** brief autocontenido; no tenés acceso a la conversación que lo originó. Leé COMPLETA la sección "Restricciones técnicas" antes de tocar código. Esta feature une dos sistemas que YA existen — casi no hay lógica nueva.

## Contexto

VSL Studio (Next.js 16 App Router + React 19) genera guiones de VSL/reels con IA. Dos piezas relevantes:

1. **Teleprompter con mapa de retención** — `src/app/guiones/[id]/teleprompter/page.tsx`. Usa `analyzeScript(markdown, wpm)` de `src/lib/readtime.ts` (heurístico, local, sin IA) que parte el guion en secciones por headings `#`/`##` y marca `leakFlags` por sección: "Sección larga (>2 min)…", "Párrafo denso (>90 palabras)…", "Sin apelación directa al espectador…". El mapa lateral (panel `showMap`) muestra cada sección con sus flags en ámbar.
2. **Refinador con streaming** — `POST /api/scripts/[id]/refine` (`src/app/api/scripts/[id]/refine/route.ts`): recibe `{ instruction: string }`, reconstruye el contexto cacheado, manda historial brief→última versión→instrucción, streamea la reescritura COMPLETA del guion por SSE y guarda una versión nueva con `refinementInstruction`. La UI del refinador vive en `src/app/guiones/[id]/page.tsx`: un `<textarea ref={refineRef}>` + `handleRefine()` que lee `refineRef.current.value` y hace el fetch con streaming.

**Lo que falta:** un puente. Cuando el mapa de retención marca una fuga, el usuario hoy tiene que salir del teleprompter, ir al detalle del guion y redactar a mano la instrucción. Queremos un botón "Corregir con IA" por sección marcada que lo haga en un click.

## Diseño elegido (no lo cambies)

**Sin cambios de API.** El refine ya acepta una instrucción libre y devuelve el guion completo; la sección se referencia por su título (el modelo tiene la última versión completa en el historial). El puente es por URL:

1. El teleprompter arma la instrucción y navega a `/guiones/[id]?refine=<instrucción url-encoded>`.
2. El detalle del guion detecta el query param, pre-llena el textarea del refinador y lo enfoca. **El usuario revisa y dispara él mismo** — no auto-ejecutar IA por navegación (evita reescrituras accidentales y gasto de tokens por un back/refresh).

## Qué construir

### 1. Teleprompter — botón por sección con fugas

En `src/app/guiones/[id]/teleprompter/page.tsx`, dentro del mapa de retención (el bloque que renderiza `analysis.sections` con `s.leakFlags`):

- En cada tarjeta de sección CON `leakFlags.length > 0`, agregar un botón/link chico "Corregir con IA" (estilo acorde al panel oscuro: texto `text-brand-sky hover:underline`, tamaño xs).
- Al click, construir la instrucción en español:

  ```
  Reescribí SOLO la sección «<título>» (va de <m:ss> a <m:ss>) para corregir estos problemas de retención:
  - <flag 1>
  - <flag 2>
  Mantené el resto del guion EXACTAMENTE igual y devolvé el guion completo.
  ```

  (`fmtTime` ya está importado en la página para los tiempos.)
- Navegar con `next/navigation` `router.push(`/guiones/${id}?refine=${encodeURIComponent(instruction)}`)`.

No toques el auto-scroll (`requestAnimationFrame`) ni los controles de velocidad/fuente.

### 2. Detalle del guion — pre-llenar el refinador

En `src/app/guiones/[id]/page.tsx` (client component):

- Leer el param con `useSearchParams()` de `next/navigation` (la página ya es `"use client"`; si el build exige Suspense boundary para `useSearchParams`, envolvé como ya lo hace `src/app/login/page.tsx`).
- En un `useEffect` (una sola vez, cuando `refineRef.current` exista): si hay `?refine=`, setear `refineRef.current.value = decodeURIComponent(valor)`, hacer `scrollIntoView({ block: "center" })` + `focus()` sobre el textarea, y limpiar el param de la URL con `router.replace` (sin recargar) para que un refresh no lo re-inyecte.
- NO auto-ejecutar `handleRefine()`. El flujo de submit existente queda intacto.

### 3. Cerrar el loop (calidad percibida)

Tras un refine exitoso el usuario vuelve al teleprompter a chequear: en la tarjeta de sección del mapa, si la sección NO tiene flags, mostrar un check sutil (✓ o icono) con "Sin fugas detectadas" — así se ve el antes/después al volver. (El teleprompter siempre muestra la última versión: `script.versions[script.versions.length - 1]`, ya es así.)

## Restricciones técnicas (LEER PRIMERO)

- **Next.js 16.2.10** — difiere de tu entrenamiento; ante dudas leé `node_modules/next/dist/docs/`. En client components los `params` se leen con `use(params)` (así ya lo hace el teleprompter); `useSearchParams` puede requerir Suspense en build. Middleware = `src/proxy.ts`. Verificá con `npm run build` y `npx tsc --noEmit` (no existe `next lint`).
- **React 19**, Tailwind 4 CSS-first (tokens en `src/app/globals.css`; el teleprompter usa el tema oscuro `bg-brand-ink`).
- Textos en español rioplatense (voseo). Sin dependencias nuevas.

## NO TOCAR

- `src/lib/readtime.ts` (las heurísticas de fuga quedan como están).
- `src/app/api/scripts/[id]/refine/route.ts` ni ningún otro endpoint (`src/app/api/**`).
- `src/lib/**`, `src/db/**`, `drizzle/**`.
- La lógica existente de `handleRefine`, versionado y streaming en `guiones/[id]/page.tsx` — solo agregás el pre-llenado.

## Criterios de aceptación

1. `npx tsc --noEmit`, `npm run build`, `npm test` en verde.
2. En el teleprompter, toda sección con flags muestra "Corregir con IA"; las secciones limpias muestran el check y NO muestran el botón.
3. Click en "Corregir con IA" → aterriza en el detalle del guion con el textarea del refinador pre-llenado (título de sección + flags + regla de "solo esa sección"), enfocado y a la vista.
4. Refrescar la página después de aterrizar NO re-inyecta la instrucción (el param se limpió).
5. Disparar el refinamiento pre-llenado genera una versión nueva cuyo `refinementInstruction` es la instrucción construida, y el guion resultante conserva las demás secciones.
6. El teleprompter sigue funcionando igual: auto-scroll, velocidad, fuente, mostrar/ocultar mapa.

## Verificación manual

`npm run dev` → abrir un guion con secciones largas (o crear una versión con un párrafo de +90 palabras sin preguntas) → `/guiones/<id>/teleprompter` → ver flags ámbar → "Corregir con IA" → revisar instrucción pre-llenada → "Refinar" → esperar el streaming → volver al teleprompter → la sección corregida ya no tiene flags (o tiene menos).
