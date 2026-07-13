# Reporte QA consolidado — agentes Sonnet — local + producción — 2026-07-12

Corrida de la skill `/qa-flujos` con 5 agentes en paralelo (misiones M1–M5 de `docs/qa/plan-de-testeo.md`) contra el dev server local, más inspección del deploy de Vercel. Los 3 hallazgos más graves fueron **verificados manualmente por el orquestador** después de los agentes.

## Resumen ejecutivo

**Hoy no se puede generar un guión de punta a punta, y la causa principal no es el generador: es la capa de datos y el entorno.** El dev server queda con su pool de 4 conexiones a Postgres atascado y a partir de ahí **toda página que toca la base se cuelga para siempre mostrando "Cargando..." sin ningún error** — exactamente la experiencia reportada por Mario ("tuve varios problemas y no entendí si funciona"). Contribuyen: un dev server zombie corriendo hace casi 3 días en el puerto 3000, la ausencia total de timeouts/manejo de error en frontend y backend, y un wizard cuyo paso 1 **no tiene botón "Siguiente"**. Además, la versión desplegada en Vercel tiene 114 días, el último deploy falló el build, y está detrás de SSO — si se probó por ahí, se probó una app vieja y rota.

Con el server reiniciado (pool fresco) la API responde en ~50 ms: la app subyacente funciona; lo que falta es resiliencia y feedback.

## Veredicto de hipótesis

| H | Veredicto | Evidencia breve |
|---|-----------|-----------------|
| H1 — `/api/settings` crashea sin claves OpenRouter | **CONFIRMADA** (por código) | `key-rotator.ts:53` singleton lanza al importar el módulo; cadena de import estático llega a `/api/settings`. No reproducida en vivo porque la key está configurada. |
| H2 — Stream cortado sin feedback | **NO PROBADA en generación** (bloqueada por C1), pero el patrón "operación async sin timeout ni feedback" se confirmó en creación de cliente (colgada en "Guardando..." para siempre) |
| H3 — Guión persiste solo al final del stream | **CONFIRMADA por código** (`api/generate/route.ts` inserta tras acumular todo); no probada en vivo |
| H4 — Sin seeds no hay frameworks | **DESCARTADA como causa actual**: la DB está sembrada (10 frameworks, 9 settings) |
| H5 — Cuota OpenRouter sin rollback | **CONFIRMADA** (por código): `reserveEnsembleCalls()` persiste el gasto antes de llamar a los modelos; ningún catch/finally la devuelve si falla |
| H6 — Onboarding confuso | **PARCIAL**: el paso 2 del wizard sí guía ("No hay clientes. Creá uno primero."), pero la home colgada y la falta de botón Siguiente (C3) impiden el arranque; re-testear con server sano |

## Hallazgos consolidados (por severidad)

### [C1] Pool de conexiones del dev server se atasca y toda la app queda en "Cargando..." eterno, sin error ni timeout — VERIFICADO
- **Severidad**: bloqueante (causa raíz nº1 de la mala experiencia)
- **Flujo**: toda la app (home, /clientes, /guiones, /configuracion, /generar, APIs)
- **Reproducción observada**: bajo requests concurrentes, las 4 conexiones del pool (`src/db/index.ts` → `max: 4` en dev, sin timeout de query) quedan tomadas; toda query posterior espera indefinidamente. El server loguea `GET /api/clients 200 in 5.0s` recién cuando el cliente aborta — la respuesta nunca llega sola.
- **Evidencia**: `curl --max-time 30 /api/clients` → sin respuesta (000); Supabase sano en paralelo (query directa 455 ms, 8 conexiones); tras reiniciar el server, la misma ruta responde 200 en 50 ms. El comentario de `src/db/index.ts:18-20` ya admite el síntoma.
- **Impacto**: la app parece "rota sin explicación"; solo la arregla reiniciar el server, cosa que un usuario no sabe.
- **Agravantes** (hallazgos M2-2, M1-3, M4-1): ningún fetch del frontend tiene `.catch`/`AbortController` (`configuracion/page.tsx:20-24`, `guiones/page.tsx`), ningún route handler tiene timeout ni try/catch de DB (`api/clients/route.ts:17`), y el botón "Crear cliente" queda en "Guardando..." sin cancelar ni reintentar.
- **Fix sugerido** (para la fase siguiente): timeout de query en postgres.js (p. ej. `statement_timeout`/`query_timeout`), pool mayor en dev, try/catch + respuesta 503 en handlers, AbortController + estado de error con "Reintentar" en los fetch del cliente.

### [C2] Dev server zombie en el puerto 3000 desde hace ~3 días — VERIFICADO
- **Severidad**: bloqueante (ambiental, explica la experiencia de Mario)
- **Evidencia**: `next-server (v16.2.10)` PID 84135, elapsed 2d 18h, 435 min de CPU, escuchando en :3000. Si Mario abría `localhost:3000`, hablaba con un proceso degradado de hace días.
- **Fix sugerido**: matar el proceso (`kill 84135`) y reiniciar con `npm run dev` fresco; considerar un check de arranque.

### [C3] El paso 1 del wizard de generación no tiene botón "Siguiente" — VERIFICADO
- **Severidad**: mayor (bloqueante para un usuario no técnico)
- **Flujo**: `/generar`, paso "Formato"
- **Reproducción**: abrir `/generar`; los únicos botones son el toggle de navegación y las 2 tarjetas VSL/Reel; clickear una tarjeta selecciona pero **no avanza**; la única forma de avanzar es clickear el label "2. Cliente" del stepper (patrón no descubrible).
- **Evidencia**: inspección DOM en vivo (querySelectorAll('button') → 4 botones, ninguno de avance).
- **Impacto**: el usuario queda atascado en el primer paso del flujo principal — muy probablemente una de las razones por las que "no se pudo redactar ningún guión".

### [C4] Producción obsoleta, rota y detrás de SSO — VERIFICADO
- **Severidad**: mayor
- **Evidencia**: deploys del proyecto Vercel `vsl` con 114 días; el último (`vsl-h6wfomylk…`) en estado **Error** — el build falló con "Error occurred prerendering page '/'"; los deploys Ready redirigen al login SSO de Vercel.
- **Impacto**: nada del trabajo reciente (pase visual, briefs, etc.) está desplegado; cualquier prueba contra esa URL fue contra código de marzo.
- **Fix sugerido**: corregir el error de prerender, redeployar, desactivar Deployment Protection o configurar dominio público.

### [C5] `/api/settings` (y todo lo que importe `openrouter.ts`) crashea al cargar el módulo si falta `OPENROUTER_API_KEYS` (H1)
- **Severidad**: mayor (latente — hoy la key existe)
- **Evidencia**: `src/lib/ai/key-rotator.ts:53` (`export const apiKeyEngine = new ApiKeyEngine()` lanza en el constructor) + import estático en `src/app/api/settings/route.ts:3`.
- **Fix sugerido**: inicialización perezosa del singleton o import dinámico como en el resto de providers.

### [C6] Cuota de OpenRouter se consume aunque la generación falle (H5)
- **Severidad**: menor (mientras OpenRouter no sea el provider principal)
- **Evidencia**: `src/lib/ai/openrouter.ts:59-68,145,223`; si los 5 especialistas fallan, se lanzó el error después de persistir el gasto de 6 llamadas.

### [C7] Mensajes de validación del server en inglés técnico (Zod crudo)
- **Severidad**: menor — `POST /api/generate` con payload inválido devuelve `"Invalid input: expected number, received undefined"`. `api/generate/route.ts:54-60`.

### [C8] Validación de formularios depende solo del `required` nativo del navegador
- **Severidad**: pulido — wizard (`generar/page.tsx:508-548`) y formulario de cliente sin mensajes propios en español.

### Positivo
- Empty states buenos en `/plantillas`, `/guiones`, `/relevamientos` (con CTA y guía).
- El paso 2 del wizard guía bien cuando no hay clientes.
- La validación Zod del backend bloquea correctamente payloads inválidos (nada basura llegó a la DB).

## Cobertura

- **Cubierto**: home, /clientes (lista y creación), /generar pasos 1-2, /configuracion (por código), endpoints `/api/generate` (validación), `/api/settings`, `/api/clients`, estados vacíos (por código), infraestructura local y deploy.
- **Pendiente para la próxima corrida (con server sano)**: generación completa con streaming (H2/H3 en vivo), editor/versiones/refinar/rating/paneles/teleprompter (toda M4), CRUD marca-oferta-campaña, intake, brief-autofill, plantillas, responsive móvil y teclado (M3.6-7). **Recomendación: re-correr `/qa-flujos` después de aplicar los fixes de C1-C3.**

## Datos de prueba creados
Ninguno persistió (verificado: `select … where name like 'QA-%'` → vacío). No hay nada que limpiar.

## Nota metodológica
El atasco C1 se disparó, en parte, por la propia concurrencia de los 5 agentes — lo cual es un resultado válido: con 2-3 pestañas o usuarios reales pasa lo mismo, y de hecho le pasó a Mario. Los agentes M2 (análisis de errores) y M3 (UX) produjeron hallazgos completos; M1, M4 y M5 quedaron parcialmente bloqueados por C1.

RESUMEN GLOBAL: 2 bloqueantes, 4 mayores, 2 menores, 1 pulido (más 6 hallazgos de detalle en los reportes de misión)
