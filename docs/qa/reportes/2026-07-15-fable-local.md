# Reporte QA — Claude Fable 5 (5 subagentes Sonnet) — local — 2026-07-15

## Resumen ejecutivo

Sí se puede generar un guión de punta a punta: la generación con OpenRouter completó en ~95s, persistió correctamente (guion 11, status `draft`) y el sistema de checkpoints/heartbeat/recuperación funciona como fue diseñado. Lo más grave es otra cosa: **bajo uso concurrente, el pool de conexiones de Postgres dentro del proceso de Next queda en estado corrupto y toda la app se cuelga para siempre** (requests que nunca responden, "Guardando…" infinito, ediciones perdidas en silencio) hasta reiniciar el server. Es la recurrencia del bug C1 ya reportado el 2026-07-12. El segundo problema estructural es la **dependencia exclusiva de modelos gratuitos de OpenRouter sin fallback a Anthropic**: cuando se saturan, el usuario ve errores crudos en inglés ("429 Provider returned error") o esperas de 90–180s sin feedback. Tercero: **no existe visibilidad de estado para trabajos en curso** — el analizador/extractor corre atado a la pestaña y no hay panel de actividad.

Verificación manual del orquestador sobre los 3 hallazgos más graves: confirmados en vivo (ver B1, Y1, Y2).

## Veredicto de hipótesis

| H | Veredicto | Evidencia breve |
|---|-----------|-----------------|
| H1 | DESCARTADA | `getApiKeyEngine()` es lazy y cacheado; `getOpenRouterQuota()` chequea `hasOpenRouterKeys()` antes de instanciar. `/api/settings` responde 200; sin la key devolvería `available:false`, no crash. (M2 y M5, por código y en vivo) |
| H2 | DESCARTADA (mecanismo original) / CONFIRMADA variante | `maxDuration` es 300s (no 60), hay heartbeat + `status.ts` degrada a `interrupted` con banner de recuperación. PERO el frontend (`generar/page.tsx` L352–382) trata cualquier cierre de stream con `scriptId` seteado como éxito y navega sin verificar `done` (ver Y4). |
| H3 | DESCARTADA | `stream.ts` crea script+versión antes del primer delta, checkpointea cada 1.5s/2048 chars y persiste contenido parcial con `status:"failed"` ante error; `cancel()` es no-op deliberado y el server sigue guardando. |
| H4 | DESCARTADA | Con seeds presentes, el colapsable "Elegir estructura manualmente" muestra 5 frameworks con rating + opción "Dejar que la IA elija". Nota: el stepper real tiene 4 pasos, no 5 (framework está anidado en el paso 3). |
| H5 | DESCARTADA | `reserveEnsembleCalls()` reserva 6 llamadas, pero `refundUnusedCalls()` en `finally` devuelve las no intentadas. Matiz: las intentadas-y-fallidas no se devuelven (razonable). |
| H6 | DESCARTADA | La home tiene "Cómo llegar a tu primer guion" con 3 pasos linkeados y la ficha de cliente sin dossier muestra empty-state con CTA. Matices reales en Y3 y m3 (no se muestra el cliente activo en el wizard; no advierte al generar sin dossier). |

## Hallazgos (ordenados por severidad)

### [B1] Pool de Postgres del proceso Next queda corrupto bajo concurrencia: toda la app se cuelga para siempre y se pierden guardados en silencio
- **Severidad**: bloqueante
- **Flujo**: transversal (editor, intake público, brief-autofill, navegación, cualquier ruta con DB)
- **Pasos para reproducir**: 1) Someter el dev server a uso concurrente (≈5 sesiones haciendo guardados, generación y autosave de intake a la vez). 2) Observar latencias crecientes (8–20s exactos por request). 3) A partir de cierto punto, requests que nunca responden: `PATCH /api/intakes/public/…` pendientes para siempre, "Guardando…" infinito en el editor, `curl /api/clients` sin respuesta en 60s aún sin carga.
- **Esperado**: degradación acotada con errores/timeouts claros y recuperación automática al bajar la carga.
- **Observado**: el proceso queda zombie permanente. Verificación del orquestador: `pg_stat_activity` del lado servidor limpio (0 conexiones vsl-studio activas), `lsof` muestra **0 sockets TCP abiertos** del proceso Next hacia el pooler (6543), conexiones frescas desde un script externo tardan ~370ms — la DB está sana; el pool de postgres.js cree tener conexiones que ya murieron y encola queries sin timeout de adquisición. Tras `preview_stop`/`start`: 200 en 40ms. Consecuencia de datos: la edición de M4 sobre el guion 10 ("Guardando…" >3 min) **nunca se persistió** — pérdida silenciosa de trabajo.
- **Impacto en el usuario**: la app entera "se rompe sola" en cualquier momento de uso real, sin error visible, y ediciones aparentemente guardándose se pierden; única cura: reiniciar el server.
- **Evidencia**: logs del dev server (`GET /api/scripts/11` 15.9s/20.0s, `POST /api/brief-autofill` 90s y 3.0min, luego requests sin completar); `HTTP 000` con `curl -m 60`; `lsof -p <next> | grep 6543` → 0; `src/db/index.ts` L11 `max: 4` sin timeout de cola. Consolidado de M1-2, M4-1, M4-2, M5-1, M5-2, M5-3; recurrencia del C1 (reporte 2026-07-12).
- **Hipótesis relacionada**: nueva (C1 recurrente)

### [Y1] IA estructurada (pre-llenado, análisis) depende solo de modelos gratuitos de OpenRouter: 429 crudo en inglés al usuario y sin fallback a Anthropic — bug reportado por el usuario, reproducido
- **Severidad**: mayor
- **Flujo**: wizard paso 3 → "Pre-llenar con IA" (`POST /api/brief-autofill`); afecta también hooks/critique/learnings (todo `generateJSON`)
- **Pasos para reproducir**: 1) `/generar` → cliente con documentos → paso Brief. 2) Click "Pre-llenar con IA".
- **Esperado**: mensaje en español accionable ("el proveedor está saturado, reintentá o cambiá a Anthropic"), o fallback automático al otro provider configurado.
- **Observado**: banner rojo literal `429 Provider returned error` (HTTP 500, body `{"error":"429 Provider returned error"}`). Análisis de código: `structured.ts` elige provider por setting y **no cascadea** si falla; el arnés 5+1 usa modelos `:free` saturados; si la síntesis final recibe 429 el error del SDK se propaga crudo (`brief-autofill/route.ts` L87 devuelve `e.message` sin `sanitizeAiError` ni traducción). En otra corrida el mismo endpoint tardó 90–180s sin feedback antes de responder (maxDuration 300).
- **Impacto en el usuario**: la función estrella de ahorro de tiempo falla con un código HTTP en inglés o cuelga minutos un botón, aunque haya una clave Anthropic válida configurada.
- **Evidencia**: M1-1 (reproducción en vivo), M5-3 (cuelgue de 180s), lectura de `src/lib/ai/structured.ts`, `src/lib/ai/openrouter.ts` L285–329, `src/app/api/brief-autofill/route.ts`.
- **Hipótesis relacionada**: nueva

### [Y2] No existe visibilidad de estado para extracciones/análisis en curso: el analizador corre atado a la pestaña y no hay panel de actividad
- **Severidad**: mayor
- **Flujo**: `/analizador` (extractor de guiones), `/biblioteca`, `/relevamientos`
- **Pasos para reproducir**: 1) Lanzar una importación en `/analizador`. 2) Cerrar o recargar la pestaña a mitad. 3) Buscar en la app dónde ver si el trabajo sigue vivo, terminó o falló.
- **Esperado**: un historial/panel de trabajos con estados (encolado/procesando/falló/listo) que sobreviva a la navegación y se actualice solo.
- **Observado**: no existe. `/analizador` es un formulario con SSE efímero (`page.tsx`: todo el estado es `useState` local); `/biblioteca` solo lista documentos ya completados; la tabla `source_assets` SÍ tiene estados (`queued/processing/needs_input/failed/ready`) pero ninguna UI los expone para el flujo del analizador. `/relevamientos` sí muestra badges de estado del intake, pero no del procesamiento de sus archivos.
- **Impacto en el usuario**: exactamente la queja reportada — "no podemos saber si sigue activo, vivo o se rompió"; hay que adivinar o repetir el trabajo a ciegas.
- **Evidencia**: M3-3; lectura de `src/app/analizador/page.tsx` y `src/db/schema.ts` L198/217.
- **Hipótesis relacionada**: nueva

### [Y3] El wizard no muestra para qué cliente se está generando y puede arrastrar un borrador de otro cliente
- **Severidad**: mayor
- **Flujo**: ficha de cliente → "Generar guion" → paso 3
- **Pasos para reproducir**: 1) Cliente nuevo sin documentos (id 10). 2) Desde su ficha, "Generar guion" (`/generar?clientId=10`). 3) El wizard salta al paso 3 con un borrador persistido de OTRO cliente (título y brief ajenos) y lista documentos de contexto del otro cliente.
- **Esperado**: el wizard refleja al cliente de la URL o, mínimo, muestra el nombre del cliente activo en el paso de Brief.
- **Observado**: ningún indicador de cliente activo en el paso 3; el borrador local pisa el `clientId` de la URL.
- **Impacto en el usuario**: riesgo real de generar y entregar un guion armado con información de otro cliente sin notarlo.
- **Evidencia**: M3-2 (accessibility tree con título/documentos de "Cliente Demo QA" bajo `clientId=10`).
- **Hipótesis relacionada**: H6 (faceta nueva)

### [Y4] Un corte del stream de generación navega al guion como éxito, sin avisar que quedó incompleto
- **Severidad**: mayor
- **Flujo**: generación, paso 4 — cortes de conexión
- **Pasos para reproducir**: (por código) cualquier cierre del SSE después de `started` y antes de `done` (red, proxy).
- **Esperado**: aviso explícito "la generación se interrumpió; el contenido parcial quedó guardado como borrador".
- **Observado**: `src/app/generar/page.tsx` L352–382: al cerrarse el stream el loop sale; si `scriptId` ya llegó, hace `router.push('/guiones/'+scriptId)` sin verificar `done`. El contenido no se pierde (checkpoints, H3 descartada) pero el usuario cree que terminó bien.
- **Impacto en el usuario**: entrega o edita un guion truncado creyendo que está completo.
- **Evidencia**: M1-3, cita de código.
- **Hipótesis relacionada**: H2 (variante)

### [m1] Paso "Formato" sin afordancia de avance (sin "Siguiente")
- **Severidad**: menor
- **Flujo**: `/generar` paso 1
- **Pasos para reproducir**: 1) Entrar a `/generar`. 2) Observar: solo dos tarjetas, sin botón de avance; el click en la tarjeta avanza solo.
- **Esperado**: pista visual de que elegir tarjeta = avanzar, o botón explícito.
- **Observado**: funciona pero sin indicación; coincide con el reporte histórico "wizard sin Siguiente".
- **Impacto en el usuario**: fricción de orientación en el primer paso.
- **Evidencia**: M1-4 (read_page: solo los dos botones de formato son interactivos).
- **Hipótesis relacionada**: nueva

### [m2] El wizard no advierte cuando se genera sin dossier aprobado
- **Severidad**: menor
- **Flujo**: cliente sin relevamiento aprobado → `/generar`
- **Pasos para reproducir**: 1) Cliente nuevo sin dossier. 2) "Generar guion" → completar brief a mano → llegar a Generar sin ninguna advertencia.
- **Esperado**: advertencia (no bloqueo) de que falta el dossier recomendado.
- **Observado**: la ficha del cliente sí advierte; el wizard no.
- **Impacto en el usuario**: guiones de baja calidad sin saber que salteó el paso recomendado.
- **Evidencia**: M3-4.
- **Hipótesis relacionada**: H6 (parcial)

### [m3] Campo "Título interno del guion" sin label accesible asociado
- **Severidad**: menor
- **Flujo**: `/generar` paso 3
- **Pasos para reproducir**: inspeccionar el árbol de accesibilidad del formulario del brief.
- **Esperado**: el campo se anuncia con su label, como los demás.
- **Observado**: el nombre accesible es el placeholder ("Ej: VSL lanzamiento curso — enero").
- **Impacto en el usuario**: lectores de pantalla/autocompletado no identifican el campo.
- **Evidencia**: M3-1 (accessibility tree).
- **Hipótesis relacionada**: nueva

### [m4] Validación de payload directo devuelve mensajes Zod crudos en inglés cuando falta una key
- **Severidad**: menor
- **Flujo**: `POST /api/generate` directo (no vía wizard)
- **Pasos para reproducir**: `curl -X POST /api/generate -d '{}'` vs `-d '{...,"title":""}'`.
- **Esperado**: mismo mensaje en español en ambos casos.
- **Observado**: key ausente → `"Invalid input: expected number, received undefined"`; key presente vacía → mensaje custom en español. Solo afecta integraciones directas.
- **Evidencia**: M2-1 (responses 400 citadas).
- **Hipótesis relacionada**: nueva

### [m5] La grilla de clientes se reordena justo después de crear uno: riesgo de abrir el cliente equivocado
- **Severidad**: menor
- **Flujo**: `/clientes` → crear → click inmediato en la primera card
- **Pasos para reproducir**: 1) Crear cliente. 2) Click rápido en la primera posición de la grilla.
- **Esperado**: abre el cliente recién creado.
- **Observado**: la grilla se reordenó entre el render y el click; abrió otro cliente real.
- **Evidencia**: M5-4.
- **Hipótesis relacionada**: nueva

### [p1] Crear cliente no muestra confirmación explícita (toast)
- **Severidad**: pulido
- **Flujo**: `/clientes` → "+ Nuevo cliente"
- **Observado**: el form se cierra y la card aparece, sin mensaje de éxito. (M5 sí observó un toast "Cliente creado" en su corrida — comportamiento inconsistente o dependiente de timing; a revisar.)
- **Evidencia**: M1-5 vs M5.
- **Hipótesis relacionada**: H6 (matiz)

### [p2] JSON malformado indistinguible de payload vacío en `/api/generate`
- **Severidad**: pulido
- **Flujo**: API directa
- **Observado**: `req.json().catch(() => ({}))` trata JSON roto como objeto vacío; mismo error de `clientId`. Robusto pero opaco para debugging.
- **Evidencia**: M2-2.
- **Hipótesis relacionada**: nueva

## Misiones cubiertas / pendientes

- **M1**: completa, salvo generación comparativa con Anthropic (bloqueada por B1).
- **M2**: pasos 1, 2, 6, 7 cubiertos; pasos 3 (framework null end-to-end), 4 (corte de stream en vivo) y 5 (estados vacíos) NO probados — server no-responsivo (B1). H2/H3/H5 verificadas por código.
- **M3**: completa (incluye responsive y accesibilidad rápida).
- **M4**: paso 1 parcial (guardado colgado = B1); pasos 2–7 (versiones, refinar, rating, paneles, teleprompter, exportar) NO probados — bloqueados por B1.
- **M5**: pasos 1 (parcial), 2, 6 cubiertos; documentos, plantillas, import-url y **extractor de guiones en vivo** NO probados — bloqueados por B1. (La brecha de visibilidad del extractor quedó confirmada por código en Y2.)

Pendiente sugerido para una segunda pasada (con B1 arreglado): M4 completa, extractor end-to-end, import-url, plantillas, corte de stream en vivo, y la pasada de producción contra Vercel.

## Update 2026-07-16 — fixes aplicados y re-test

- B1: causa raíz confirmada (pool postgres.js corrupto en el proceso, con `write CONNECTION_DESTROYED` bajo apertura concurrente de conexiones contra Supavisor). Fix: pool max 10 + keepalive + watchdog de dos strikes que recrea el pool solo (falla rápido en ~18s en vez de colgarse para siempre). Ráfagas sintéticas de 36 queries simultáneas siguen degradando (limitación del driver contra el pooler); el uso real de 1–3 personas queda holgado y en Vercel no aplica (1 request por instancia).
- Y1: errores de IA traducidos y accionables (`describeAiError`); Anthropic eliminado por decisión de producto — OpenRouter único proveedor con rotación de claves.
- Y2: implementado — tabla `analysis_jobs`, `GET /api/analyze/jobs`, panel "Trabajos recientes" en `/analizador` con estados por heartbeat.
- Y3, Y4, m1, m2, m4: arreglados y verificados en UI. m3: falso positivo (el label ya estaba asociado).
- **M4 re-testeada completa con el pool arreglado: todo OK** (guardar con confirmación en segundos, autosave, refinar con streaming, rating, paneles, teleprompter, exportar). Hallazgo nuevo mayor: seleccionar una versión vieja no persiste como activa y no hay acción directa "restaurar esta versión" (el camino editar-y-guardar existe pero es poco descubrible). Hallazgo menor: doble-fetch benigno de `/api/scripts/[id]/metrics` en dev.
- Hallazgo de seguridad en la configuración de producción reportado por canal privado al equipo (no se detalla acá por ser este un repo público).
- Datos QA de ambas corridas eliminados de la DB; guion 10 restaurado byte-idéntico (v1, v2 y su rating original).

## Datos de prueba creados (para limpieza)

- Clientes: `QA Test Cliente` (id 9), `QA-M3 Cliente` (id 10), `QA-Cliente M5` (id 11).
- Guion: id 11 "QA-M1 Guion critico end-to-end" (cliente "Cliente Demo QA", status draft, completo).
- Relevamiento: "QA-Relevamiento M5" (publicId `bdd8eb6b-4471-4167-82d6-23532c0ab04e`, borrador, datos de contacto parciales).
- Cuota OpenRouter consumida: 12 llamadas (2 corridas de arnés 5+1) + llamadas de brief-autofill.
- Guion 10 del usuario: **intacto** (la línea "QA-test" de M4 nunca se persistió; rating 4/5 sin tocar; ninguna versión promovida). Configuración restaurada a sus valores originales por M5.
- Posible residuo de browser (no DB): clave `vsl-draft-10-15` en localStorage con texto de prueba.
