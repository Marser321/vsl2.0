# Auditoría masiva de VSL Studio — 2026-07-13

## Resultado ejecutivo

La generación de VSL quedó operativa en producción de extremo a extremo: navegador/API → OpenRouter → checkpoints → versión persistida → recarga. Se conservaron seis guiones `AUD-`, dos dossiers aprobados y dos ejemplares privados promovidos. El login propio, los relevamientos públicos, la base, Supabase, el editor, el versionado y los binarios sociales fueron validados sin mocks.

El cierre es **verde para generación y relevamientos** y **condicional para transcripción de audio social**. El MVP ya no depende de `OPENAI_API_KEY`: intenta subtítulos públicos y automáticos, luego el modelo gratuito multimodal de OpenRouter y, si se configura, Whisper de Groq como respaldo. La cuenta actual de OpenRouter todavía requiere una carga mínima de USD 0,50 para habilitar entradas de audio; los subtítulos públicos y todo el flujo de generación siguen disponibles.

- URL canónica: <https://vsl-self.vercel.app>
- Deploy final: `dpl_8ovoaU5rJquoqK2WNU3jUfJitE72`
- Deploy inspeccionable: <https://vercel.com/marios-projects-4a53e443/vsl/8ovoaU5rJquoqK2WNU3jUfJitE72>
- Protección Vercel: `ssoProtection.deploymentType=preview`; producción usa el login propio.
- OpenRouter al cierre: 89/200 llamadas usadas, 111 disponibles. Incremento de auditoría: 83 llamadas desde la línea base de 6.
- Suite final: 84 unitarias, build Next.js 16.2.10, 12 E2E aprobadas y 2 omitidas por fixture ausente, 0 vulnerabilidades npm de producción.

## Matriz navegador → API → base → respuesta

| Misión | Navegador | API | Base/servicio | Respuesta | Estado |
|---|---|---|---|---|---|
| Acceso interno | `/` redirige a `/login`; desktop y móvil | login inválido 401; válido 200; readiness sin sesión 401 | sesión HS256, hash Argon2 y rate limit activos | navegación autenticada sin errores de consola | Verde |
| Relevamiento público Mario | enlace abierto en contexto limpio, sin SSO | autosave 0→100%, submit, review y approve | intake `3a55cdcf-5af8-4136-a291-d31ad176c3fa`; marca/oferta/campaña `1/1/1` | aprobado y prefill correcto | Verde |
| Relevamiento Demo QA | wizard público y archivo firmado | `submitted → in_review → changes_requested → submitted → approved` | intake `cea30f1c-3f8c-4a11-915c-b13e5b36f72f`; marca/oferta/campaña `2/2/2`; 2 snapshots | texto, URL y TXT privados promovidos | Verde |
| Generación Clásico interrumpida | cliente cerró el stream tras `started` | registro pasa a `interrupted`; retry crea otra versión | script 5; versiones parciales conservadas; versión 9 completa | `draft`, 7.582 caracteres, recargable | Verde |
| Lote OpenRouter | seis recorridos reales | todos emitieron `started`, `status`, `delta`, `done` | scripts 5–10, contexto y usage persistidos | seis guiones disponibles en Guiones | Verde |
| Ganadores | detalle, teleprompter y biblioteca | rating y promote | documentos privados 21 y 22 | una promoción por versión, sin duplicados | Verde |
| Social directo | YouTube, Instagram y TikTok | estados de validación/descarga y error SSE | `yt-dlp_linux` y FFmpeg ejecutables | fallback de upload accionable | Verde con fallback |
| Social por upload | MP3 firmado subido y descargado | `validando → transcribiendo → error accionable` | Supabase limpia el objeto en `finally` | OpenRouter informa el saldo mínimo de activación; no se guarda análisis incompleto | Pendiente de saldo o Groq |
| CRUD/errores | pantallas críticas desktop/móvil | settings, stats, frameworks, templates y docs 200; CRUD temporal 201/200/404; CSRF 403; métrica vacía 400 | datos temporales eliminados | sin 5xx ni duplicados | Verde |

## Relevamientos y contexto conservado

### Mario Morera

- Marca: Mario Morera.
- Oferta: Diseño 360 para empresas.
- Audiencia: responsables de empresas con comunicación visual inconsistente.
- Dolores: piezas desalineadas, decisiones improvisadas y dificultad para ser reconocible.
- CTA: **Agendar diagnóstico**.
- Restricción verificada: no se cargaron precios, testimonios, métricas ni resultados inventados.
- Documento privado promovido desde el intake: 17, `AUD-Mario-principios-de-copy`.

### Cliente Demo QA

- Caso explícitamente controlado, sin claims comerciales.
- Assets listos: texto `17455154-9c3a-4800-a51a-083aca77c3ce`, URL `b43cd06f-881b-495f-b48c-0b8cdde5b0c6` y TXT privado `f87636be-a635-4c99-b239-0c429257492a`.
- Documentos privados promovidos: 18, 19 y 20.

## Lote de guiones y calidad

| Guion | Script / versión final | Framework | Resultado final | Rúbrica | Promoción |
|---|---:|---|---|---:|---|
| AUD-Mario-VSL-Clásico | 5 / 9 | VSL Clásico | AI, 7.582 caracteres, recuperado tras interrupción | 4,09/5 | No |
| AUD-Mario-PAS | 6 / 18 | PAS | versión manual auditada, 569 palabras, cierre 4:00 | 4,24/5 | No |
| AUD-Mario-4Ps | 7 / 19 | 4Ps | versión manual auditada, 675 palabras, cierre 5:00 | 4,18/5 | No |
| AUD-Mario-Reel-Lista | 8 / 12 | Lista | AI, tres señales, 45 s | 4,63/5 | Doc 21, privado cliente 3 |
| AUD-Control-AIDA | 9 / 13 | AIDA | AI, caso controlado, 5 min | 4,28/5 | Doc 22, privado cliente 1 |
| AUD-Control-UGC | 10 / 15 | UGC | AI refinado; métricas falsas eliminadas | 3,95/5 | No |

Los seis runs exitosos usaron tres modelos disponibles del ensemble y quedaron marcados `degraded=true`; las propuestas de proveedores que no respondieron no bloquearon la síntesis. Tiempos reales: Clásico 177,5 s, PAS 200,0 s, 4Ps 145,3 s, Reel 133,7 s, AIDA 127,5 s y UGC 136,5 s.

Los primeros PAS/4Ps incumplieron la duración. Los refinamientos AI tampoco respetaron el límite en forma consistente. Se corrigieron mediante el editor/versionado y se reforzó el prompt futuro con presupuesto de palabras ±10%, timestamp final obligatorio y prohibición explícita de inventar cifras o entregables. Las versiones AI fuera de rango se conservan como trazabilidad, pero no son las versiones activas puntuadas.

## Hallazgos corregidos

1. **Timeout de generación:** `/api/generate` y retry tenían `maxDuration=60`; los runs reales demoraron 127–200 s y Vercel cerraba el SSE antes de `done`. Se amplió a 300 s en generación, retry, refine y operaciones AI relacionadas; regresión automática incluida.
2. **Falso `interrupted` durante ensemble:** el heartbeat solo cambiaba al recibir deltas; la fase de cinco propuestas puede superar 90 s. Los eventos `status` ahora renuevan el heartbeat.
3. **Binario social de plataforma equivocada:** el deploy llevaba el Mach-O local y postinstall lo aceptaba solo por tamaño. El instalador valida magic bytes y descarga `yt-dlp_linux` en build; el log de Vercel confirma el binario Linux de 38 MB.
4. **Dependencia de OpenAI eliminada:** la extracción usa `input_audio` de OpenRouter con `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`; `GROQ_API_KEY` queda como respaldo opcional con `whisper-large-v3-turbo`. Referencias: <https://openrouter.ai/docs/guides/overview/multimodal/audio> y <https://console.groq.com/docs/speech-to-text>.
5. **Readiness específico de audio:** consulta el crédito total de OpenRouter sin ejecutar una transcripción. Distingue claves rechazadas, indisponibilidad temporal y la condición real de saldo mínimo. Los errores sanitizan posibles fragmentos de claves y tienen regresiones automáticas.
6. **UGC con métricas inventadas:** la primera versión añadió tiempos y porcentajes inexistentes. Se refinó, se penalizó en la rúbrica y no se promovió.
7. **Duración VSL débilmente especificada:** el prompt VSL no imponía límites, a diferencia del Reel. Se añadió rango de palabras, timestamp de cierre y restricción de evidencia; PAS y 4Ps quedaron corregidos en versiones nuevas.

## Importación social

- YouTube público controlado: `validando → obteniendo_subtitulos → descargando_audio`; la plataforma exigió sesión desde la IP de Vercel y se ofreció upload.
- Instagram: `validando → descargando_audio`; exigió sesión y se ofreció upload.
- TikTok: `validando → descargando_audio`; descarga rechazada y se ofreció upload.
- Pipeline actualizado: límite real de 7 minutos verificado con FFmpeg tanto para URLs como para uploads, subtítulos manuales/automáticos de YouTube antes del audio y bloques MP3 mono de 3 minutos para reducir tamaño y timeout.
- Upload MP3 controlado: objeto privado real en Supabase, descarga, FFmpeg mono y solicitud multimodal de OpenRouter alcanzada. OpenRouter respondió 402 porque la cuenta no tiene los USD 0,50 de saldo mínimo que exige para audio, aun usando el modelo gratuito. La comprobación autoritativa del directorio confirmó cero objetos después del `finally`.
- Readiness final muestra `configured=true`, `available=false`, `validated=true`, proveedor `openrouter` y el mensaje exacto de activación. Al cargar USD 0,50 o añadir `GROQ_API_KEY`, hay que repetir esta única misión para obtener transcript >100 caracteres, análisis y documento en Biblioteca.

## Verificación posterior al despliegue sin OpenAI

- Deploy `dpl_8ovoaU5rJquoqK2WNU3jUfJitE72`: `Ready`, target `production`, alias canónico activo y build remoto de 37 s.
- Variables de producción: `OPENAI_API_KEY` y `OPENAI_TRANSCRIPTION_MODEL` eliminadas; `TRANSCRIPTION_PROVIDER=auto` y `OPENROUTER_TRANSCRIPTION_MODEL` instaladas.
- Navegador limpio: `/analizador` redirige a `/login?next=%2Fanalizador`; la pantalla muestra el login propio, sin overlay ni errores de consola.
- HTTP público: `/` responde 307 al login, `/login` responde 200 y `/api/readiness` sin sesión responde 401.
- Logs Vercel del nuevo deploy: cero errores desde su publicación.
- La sesión administrativa anterior no estaba disponible en el navegador de verificación y las variables sensibles de Vercel no son reexportables. No se desactivó `REQUIRE_AUTH` para forzar una prueba; el upload real se ejecutó contra Supabase/OpenRouter desde el mismo módulo de ingesta y no mediante la ruta autenticada de producción.

## Evidencia visual

- [Login desktop](./evidencias-2026-07-13/desktop-login.png)
- [Guion ganador desktop](./evidencias-2026-07-13/desktop-guion-ganador.png)
- [Generador con parámetros de contexto](./evidencias-2026-07-13/desktop-generador-prefill.png)
- [Guion ganador móvil](./evidencias-2026-07-13/mobile-guion-ganador.png)
- [Teleprompter móvil](./evidencias-2026-07-13/mobile-teleprompter.png)
- [Relevamiento público aprobado](./evidencias-2026-07-13/public-relevamiento-aprobado.png)
- [Copy PAS final medido](./evidencias-2026-07-13/AUD-Mario-PAS-corregido.md)

La pasada Playwright de producción no registró errores de consola ni `pageerror`. El relevamiento público respondió 200 y terminó en `/relevamiento/540b4f02-ec5b-4bfe-81e1-8e0f2ec0d1b3`, sin Vercel SSO.

## Limpieza y pendientes

- Eliminados: cliente `QA-GPT Cliente Auditoría 2026-07-12`, cliente CRUD `AUD-TEMP-CRUD`, plantilla temporal y ambos uploads de análisis.
- Conservados: clientes Mario Morera y Cliente Demo QA, dos intakes aprobados, materiales necesarios, seis guiones, versiones de interrupción/refinamiento y dos documentos ganadores.
- `Diseño sin limites` permanece con script 4, estado efectivo `interrupted`, una versión y cero caracteres: el registro no se perdió y el UI lo ofrece como recuperable.
- Pendiente externo único: cargar al menos USD 0,50 en la cuenta de OpenRouter (el modelo configurado sigue siendo gratuito) o añadir `GROQ_API_KEY`, y repetir el upload social completo. No se puede declarar transcript/análisis verde hasta superar esa frontera externa.
