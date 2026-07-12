# Brief: Métricas reales de plataformas → señal de calidad — VSL Studio

> **Para el agente ejecutor (GPT/Codex):** brief autocontenido; no tenés acceso a la conversación que lo originó. Leé COMPLETA la sección "Restricciones técnicas" antes de tocar código. Es el brief más grande del backlog: tocás schema (migración), un endpoint nuevo, el detalle del guion, stats y el ranking de ejemplares. Andá por fases y commiteá por fase.

## Contexto

VSL Studio (Next.js 16 App Router + Drizzle/Postgres Supabase) tiene un **loop de puntuación interno**: cada versión de guion recibe 1–5★ del equipo (tabla `scriptRatings`, única por `scriptVersionId`, con `tags` y `notes` — ver `src/db/schema.ts`). Esa señal alimenta:

- `GET /api/stats` (`src/app/api/stats/route.ts`): promedios de ★ y `wonRate` por framework/proveedor/formato, mostrados en `/aprendizajes` (`src/app/aprendizajes/page.tsx`) y como chip "Recomendado" en el wizard de generación.
- `suggestedDocuments(clientId)` en `src/lib/ai/context-builder.ts`: rankea los documentos ejemplares (promovidos desde guiones vía `documents.sourceScriptId`) por el promedio de ★ del guion de origen; los ≤2★ se destildan (`preselect: false`).
- El campo `scripts.outcome` (`"unknown" | "won" | "lost"`) marca guiones ganadores a mano.

**Lo que falta:** la señal dura del mercado. Cuando un guion se publica como ad en Meta/TikTok, el equipo ve retención a 3s (hook rate), CTR, CPA — hoy esos números no entran al sistema. Objetivo: pegarlos por versión de guion, mostrarlos, y que complementen las ★ (criterio interno) con datos reales. La versión con mejores métricas se marca como **candidata a ganadora** (sugerencia con un click, NO promoción automática silenciosa).

## Qué construir

### Fase 1 — Schema + migración

En `src/db/schema.ts`, nueva tabla siguiendo las convenciones del archivo (serial PK, timestamps `withTimezone`, índices con el patrón existente):

```ts
export const PLATFORMS = ["meta", "tiktok", "youtube", "otro"] as const;
export type MetricPlatform = (typeof PLATFORMS)[number];

export const scriptMetrics = pgTable(
  "script_metrics",
  {
    id: serial("id").primaryKey(),
    scriptVersionId: integer("script_version_id")
      .notNull()
      .references(() => scriptVersions.id, { onDelete: "cascade" }),
    platform: text("platform").$type<MetricPlatform>().notNull(),
    // Porcentajes 0–100 con decimales; CPA en moneda libre (el equipo usa USD).
    hookRate: real("hook_rate"),        // retención a 3s, el KPI primario
    ctr: real("ctr"),
    cpa: real("cpa"),                    // menor = mejor
    impressions: integer("impressions"),
    notes: text("notes"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("script_metrics_version_platform_uq").on(table.scriptVersionId, table.platform)]
);
export type ScriptMetric = typeof scriptMetrics.$inferSelect;
```

(`real` se importa de `drizzle-orm/pg-core`.) Una fila por versión+plataforma, con upsert: cargar de nuevo pisa el snapshot anterior (el histórico fino no es objetivo de esta fase). Generar y aplicar migración: `npm run db:generate` → revisar el SQL generado en `drizzle/` → `npm run db:migrate`.

### Fase 2 — Endpoint `api/scripts/[id]/metrics`

Crear `src/app/api/scripts/[id]/metrics/route.ts` (mirar como referencia el patrón de las subrutas hermanas en `src/app/api/scripts/[id]/` — `rating`, `critique`, etc.):

- **GET**: guard `guardAdminRequest()`; devuelve todas las métricas de todas las versiones del guion: `{ metrics: Array<ScriptMetric & { versionNumber: number }> }` (join con `scriptVersions` filtrando por `scriptId`).
- **POST**: guard `guardAdminRequest(req, true)`; body Zod:
  ```ts
  z.object({
    versionId: z.number().int(),
    platform: z.enum(PLATFORMS),
    hookRate: z.number().min(0).max(100).nullable().optional(),
    ctr: z.number().min(0).max(100).nullable().optional(),
    cpa: z.number().min(0).nullable().optional(),
    impressions: z.number().int().min(0).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  ```
  Validar que `versionId` pertenece al guion `[id]` (404 si no). Upsert con `onConflictDoUpdate` sobre el índice único (`target: [scriptMetrics.scriptVersionId, scriptMetrics.platform]`), actualizando `updatedAt`. Al menos un campo numérico requerido (refine de Zod).
- **DELETE** (opcional pero deseable): borra la fila de una versión+plataforma.

### Fase 3 — UI en el detalle del guion

Componente nuevo `src/components/MetricsPanel.tsx`, montado en `src/app/guiones/[id]/page.tsx` cerca del `RatingWidget` (misma zona de "evaluación"):

- Lista las métricas cargadas por versión (`v3 · Meta — hook 38% · CTR 1.2% · CPA $14 · 12.400 imp.`), con la versión actual resaltada.
- Form compacto para cargar/editar: select de plataforma, inputs numéricos (hook rate %, CTR %, CPA, impresiones), notas. Aplica a la **versión actualmente seleccionada** en la página (la página ya maneja la versión activa con pills).
- Feedback con el mecanismo del design system vigente (si ya existen toasts de `sonner` por el pase visual, usalos; si no, banner inline como el resto de la página).
- **Banner "candidata a ganadora":** si alguna versión tiene `hookRate` cargado con `impressions >= 1000` (o impresiones sin cargar — no bloquear por dato faltante) y es la mejor del guion (mayor `hookRate`; empate → mayor CTR; empate → menor CPA), mostrar banner: "La v<N> tiene las mejores métricas reales — promovela como ejemplar" con botón que dispare el flujo de promoción EXISTENTE (`POST /api/scripts/[id]/promote` — mirar cómo lo invoca hoy la página con su banner de promoción). NO auto-promover ni tocar `scripts.outcome` automáticamente.

### Fase 4 — Señal en stats y en el ranking de ejemplares

1. **`src/app/api/stats/route.ts`:** agregar al `Promise.all` dos queries sobre `scriptMetrics` (join `scriptVersions` → `scripts`, mismos filtros `format`/`industry` que las demás): promedio de `hookRate` y `ctr` + `n` por framework y por proveedor. Sumar al JSON de respuesta como `metricsByFramework` y `metricsByProvider` (campos nuevos — NO cambiar la forma de los existentes; la UI actual de `/aprendizajes` no debe romperse antes de la fase 4.2).
2. **`/aprendizajes` (`src/app/aprendizajes/page.tsx`):** nueva tabla "Métricas reales" (por framework y por proveedor: n, hook rate medio, CTR medio) debajo de las tablas de ★ existentes, con nota al pie: "Fuente: métricas cargadas a mano desde Meta/TikTok".
3. **`suggestedDocuments` en `src/lib/ai/context-builder.ts`:** extender `SuggestedDocument` con `bestHookRate: number | null` — para docs con `sourceScriptId`, el mejor `hookRate` entre las versiones de ese guion (una query agregada más, siguiendo el patrón de `avgByScript` que ya está en la función). **La regla de `preselect` NO cambia** (sigue siendo por ★). En el wizard (`src/app/generar/page.tsx`, paso de documentos), donde hoy se muestra el promedio de ★ de un doc, mostrar además un chip con `hook <X>%` cuando `bestHookRate` exista. Cambio de UI mínimo y aditivo.

## Restricciones técnicas (LEER PRIMERO)

- **Next.js 16.2.10** — difiere de tu entrenamiento; ante dudas leé `node_modules/next/dist/docs/`. `params` es Promise (`await params` en routes, `use(params)` en client components); middleware = `src/proxy.ts`; verificá con `npm run build` y `npx tsc --noEmit` (no existe `next lint`).
- **Drizzle**: migraciones SOLO vía `npm run db:generate` + `npm run db:migrate` (nunca editar a mano las migraciones aplicadas en `drizzle/`). `getDb()` de `@/db`.
- **Regla del proyecto para schemas de salida estructurada de IA: no aplica acá** (no hay llamadas de IA en esta feature — es captura manual + agregación SQL).
- Zod v4 en todo input. Textos de UI en español rioplatense (voseo). Sin dependencias nuevas.
- Números: los promedios de SQL llegan como string/unknown — normalizar con `Number(...)` como ya hace `/api/stats` (`const num = (v: unknown) => Number(v ?? 0)`).

## NO TOCAR

- El motor de generación y caché: `src/lib/ai/provider*`, `prompts`, `structured`, `anthropic`, `openrouter` — nada. En `context-builder.ts` SOLO se toca `suggestedDocuments` (la función `buildContext` y los bloques cacheados quedan intactos: esta señal NO entra al prompt en esta fase).
- `scriptRatings` y su endpoint/widget (las ★ siguen igual; las métricas son señal paralela).
- El flujo de promote existente (se invoca, no se modifica).
- Tablas existentes del schema (solo AGREGÁS `scriptMetrics`).

## Criterios de aceptación

1. `npx tsc --noEmit`, `npm run build`, `npm test` en verde; migración aplicada sin tocar tablas existentes.
2. Cargar métricas para una versión desde el detalle del guion → persisten; recargar y editar → upsert (no duplica).
3. Dos versiones con métricas → el banner de candidata señala la correcta (mayor hook rate; desempates CTR y CPA) y el botón promueve vía el flujo existente.
4. `/aprendizajes` muestra la tabla de métricas reales; las tablas de ★ existentes no cambian.
5. `GET /api/stats` conserva intactos los campos previos (`totalRatings`, `byFramework`, `byProvider`, `byFormat`) y suma los nuevos.
6. En el wizard, los docs ejemplares cuyo guion de origen tiene métricas muestran el chip de hook rate; el resto se ve igual que antes.
7. Todo endpoint nuevo responde 401 sin sesión cuando `REQUIRE_AUTH=true`.

## Verificación manual

`npm run dev` → abrir un guion con 2+ versiones → cargar métricas distintas en dos versiones (Meta) → ver lista + banner de candidata → promover → verificar el doc ejemplar en la biblioteca → `/aprendizajes` (tabla nueva con datos) → `/generar` hasta el paso de documentos (chip de hook rate en el ejemplar). Editar una métrica y verificar que pisa en vez de duplicar.
