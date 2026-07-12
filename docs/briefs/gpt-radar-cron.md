# Brief: Radar de tendencias programado (cron semanal) — VSL Studio

> **Para el agente ejecutor (GPT/Codex):** brief autocontenido; no tenés acceso a la conversación que lo originó. Leé COMPLETA la sección "Restricciones técnicas" antes de tocar código.

## Contexto

VSL Studio (Next.js 16 App Router + Drizzle/Postgres Supabase, deploy en **Vercel**) tiene un **radar de tendencias** manual: en la ficha de un cliente, un botón dispara `POST /api/clients/[id]/radar` (`src/app/api/clients/[id]/radar/route.ts`), que:

1. Arma queries con `clients.industry` + `brands.industry/subindustry` del cliente (+ keywords opcionales).
2. Lee Google News RSS vía `fetchGoogleNews(queries)` (`src/lib/radar/rss.ts` — sin API keys, ventana 7 días, anti-SSRF, máx. 3 queries).
3. Sintetiza 3–5 "ángulos de oportunidad" con `generateJSON` (`src/lib/ai/structured`) contra `RADAR_SCHEMA`.
4. Desactiva los documentos `[RADAR]` anteriores del cliente (docs `kind: "reference"` con tag `"radar"`) y guarda uno nuevo: `documents` con `title: "[RADAR] <rubro> — <fecha>"`, `tags: ["radar", "radar-<fecha>"]`, `visibility: "private"`, `tokenCount` calculado con `countTokens` de `@/lib/ai/anthropic`.

**Lo que falta:** que esto corra solo cada lunes temprano para todos los clientes con rubro definido, y avise por email. Email ya integrado: `resend` está en `package.json`, `src/lib/email.ts` muestra el patrón completo (cliente Resend lazy, registro en tabla `emailDeliveries` con `idempotencyKey` único, estados `sent/failed/skipped`, y `Idempotency-Key` header hacia Resend).

## Qué construir

### 1. Extraer la lógica del radar a `src/lib/radar/run.ts`

Hoy los pasos 1–4 viven inline en el route handler. Extraer una función reutilizable:

```ts
export async function runRadarForClient(clientId: number, keywords = ""): Promise<
  | { ok: true; doc: Document; angulos: RadarAngle[]; headlines: number }
  | { ok: false; reason: "sin-rubro" | "sin-noticias" | "error"; message: string }
>
```

- Mover TODO el cuerpo del POST actual (queries, `fetchGoogleNews`, prompt, `generateJSON`, desactivación de radares viejos, insert del doc) a esa función, **sin cambiar su comportamiento**. Mover también `RADAR_SCHEMA`, `HOOK_ANGLES` y el tipo `RadarAngle`.
- El route handler `src/app/api/clients/[id]/radar/route.ts` queda como cáscara fina: guard de auth + validación Zod del body + llamar `runRadarForClient` + traducir el resultado a la MISMA respuesta HTTP de hoy (404 cliente inexistente, 400 sin rubro / sin noticias, 201 con `{ doc, angulos, headlines }`, 500 en error). **La UI existente no debe notar el refactor.**

### 2. Endpoint de cron `GET /api/cron/radar`

Crear `src/app/api/cron/radar/route.ts`:

- **Protección:** Vercel Cron manda `Authorization: Bearer ${CRON_SECRET}` (variable de entorno que Vercel inyecta si está definida en el proyecto). Verificar: `req.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`` → si no, `401`. Si `CRON_SECRET` no está definido, responder `503` con error claro (nunca correr sin protección). NO usar `guardAdminRequest` acá (el cron no tiene sesión).
- **Idempotencia:** los docs de radar llevan tag `radar-<fecha ISO>`. Antes de correr un cliente, chequear si ya existe un documento activo con tag `radar-<hoy>` para ese cliente (query a `documents` filtrando `clientId`, `isActive`, y el tag — `tags` es `jsonb`; en Drizzle: `sql`${documents.tags} ? ${tag}`` o filtrar en JS tras traer los docs `reference` activos del cliente, como ya hace el route actual). Si existe → skip.
- **Selección:** todos los `clients` cuyo `industry` no sea null/vacío, **o** que tengan alguna brand con `industry` definido (misma lógica de queries que `runRadarForClient` ya resuelve — si la función devuelve `{ ok: false, reason: "sin-rubro" }`, simplemente se cuenta como skip).
- **Ejecución en serie** (no `Promise.all`): cada cliente hace fetch a Google News + una llamada de IA; en paralelo agotaría rate limits. Envolver cada cliente en try/catch: un fallo no aborta el resto.
- `export const maxDuration = 300;` (plan Pro de Vercel; si el proyecto está en Hobby el límite del cron igual corta — dejar constancia en un comentario).
- Respuesta: `{ ran: n, skipped: n, failed: n, details: [{ clientId, name, status, message? }] }`.

### 3. Aviso por email

En `src/lib/email.ts`, agregar `sendRadarDigestEmail(args: { date: string; results: Array<{ clientName: string; status: "ok" | "skipped" | "failed"; angulos?: number }> })`, siguiendo EXACTAMENTE el patrón de `sendIntakeSubmittedEmail` que ya está en ese archivo:

- `idempotencyKey: "radar-weekly-<date>"` (un solo mail por corrida semanal).
- `kind: "radar_weekly"` en `emailDeliveries` (`intakeRequestId` queda null — la columna es nullable).
- Destinatario: `process.env.INTAKE_NOTIFICATION_EMAIL` (reusar; si falta o falta `RESEND_API_KEY`, registrar `status: "skipped"` como hace la función existente).
- HTML simple en español: "Radar semanal — <fecha>", lista de clientes con ✓/— y cantidad de ángulos, link `${NEXT_PUBLIC_APP_URL}/clientes`. Escapar con el helper `escapeHtml` ya presente en el archivo.
- Llamarla al final del handler del cron **solo si `ran + failed > 0`** (si todo fue skip, no hay novedad).

### 4. `vercel.json`

No existe — crearlo en la raíz:

```json
{
  "crons": [{ "path": "/api/cron/radar", "schedule": "0 8 * * 1" }]
}
```

`0 8 * * 1` = lunes 08:00 **UTC** (05:00 en Montevideo). Los crons de Vercel son siempre UTC — dejar el comentario en el README o en el propio handler.

### 5. Documentar variables

En el README, sección de variables de entorno: agregar `CRON_SECRET` (generar con `openssl rand -hex 32`).

## Restricciones técnicas (LEER PRIMERO)

- **Next.js 16.2.10** — difiere de tu entrenamiento; ante dudas leé `node_modules/next/dist/docs/`. `params` es Promise; middleware = `src/proxy.ts`; verificación con `npm run build` y `npx tsc --noEmit` (no existe `next lint`).
- **`src/proxy.ts` puede interceptar rutas**: revisá que `/api/cron/*` no quede detrás del gate de auth del proxy; si el matcher lo cubre, excluílo (el cron se autentica por `CRON_SECRET`, no por sesión).
- Drizzle ORM (`getDb()` de `@/db`); Zod v4 para todo input externo.
- Sin dependencias nuevas. Textos en español rioplatense.

## NO TOCAR

- `src/lib/radar/rss.ts` (el fetch de RSS ya está probado).
- `src/lib/ai/**` (motor de IA; `generateJSON` se consume tal cual).
- El contrato HTTP del endpoint manual `POST /api/clients/[id]/radar` (la UI del botón de radar depende de él).
- `src/db/schema.ts` — no hacen falta tablas nuevas (la idempotencia usa tags de `documents` y `emailDeliveries` existentes).

## Criterios de aceptación

1. `npx tsc --noEmit`, `npm run build`, `npm test` en verde.
2. El botón de radar manual en la ficha de cliente sigue funcionando idéntico (mismo shape de respuesta).
3. `GET /api/cron/radar` sin `Authorization` correcto → 401; sin `CRON_SECRET` definido → 503.
4. Con 2+ clientes con rubro: una corrida genera un doc `[RADAR]` nuevo por cliente, desactiva los anteriores, y una segunda corrida el mismo día responde todo `skipped` sin duplicar docs.
5. Se registra UNA fila en `emailDeliveries` con `kind: "radar_weekly"` por corrida (o `skipped` si Resend no está configurado).
6. `vercel.json` con el cron del lunes 08:00 UTC.

## Verificación manual

`npm run dev` con `.env.local` completo → `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/radar` → revisar respuesta JSON, docs `[RADAR]` nuevos en la ficha de los clientes, fila en `email_deliveries`. Repetir el curl → todo `skipped`.
