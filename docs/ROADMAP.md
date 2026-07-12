# Roadmap — VSL Studio

Estado al 2026-07-12. Los cinco briefs ejecutables quedaron implementados y verificados; abajo se conserva el backlog de ideas laterales todavía pendientes.

## Hecho (julio 2026)

- **Corpus fundacional** (`npm run db:seed-corpus`): 12 docs de doctrina original en español (ecuación de valor estilo Hormozi, VSL clásico estilo Benson, mensaje 4 partes estilo Suby, gancho-historia-oferta estilo Brunson, reglas de oro VSL, playbook de reels, taxonomía de 10 ganchos, objeciones/precio, niveles de conciencia, 3 desgloses estructurales beat-a-beat) + 5 frameworks de reel + 5 plantillas builtin. Entra al Bloque 1 cacheado de todas las generaciones (~8k tokens).
- **Formato Reel** (15–90s): paso "Formato" en el wizard, contrato de salida en segundos con `[TEXTO EN PANTALLA]`, hooks reel-aware, badges.
- **Editor manual**: edición directa del guion con coalescing de versiones, Cmd+S, borrador local, contador de duración, checklist de marcadores `{{ }}`, "Aplicar en editor" desde la crítica.
- **Puntuación 1-5★ por versión** con tags de factores → alimenta: ranking de ejemplares promovidos (los ≤2★ se destildan del contexto), stats por framework/proveedor/formato con chip "Recomendado" en el wizard, doc regenerable `[AUTO] Preferencias aprendidas del equipo` (Bloque 1), extracción de anti-patrones a `industry_learnings`.
- **Plantillas**: 5 builtin + "guardar como plantilla"; usar plantilla → aterriza en el editor con placeholders resueltos por cliente.
- **Pase visual profesional**: design system reutilizable, toasts con Sonner, estados de carga/error/vacío, diálogos accesibles, responsive y marca/metadata.
- **Importador de transcripts de YouTube**: URL → captions públicos → Analizador; conserva fallback manual cuando el video no ofrece subtítulos.
- **Reescritura guiada por retención**: las fugas detectadas en teleprompter abren el refinador con una instrucción específica y editable.
- **Radar de tendencias semanal**: runner compartido manual/cron, ejecución serial e idempotente los lunes 08:00 UTC, con digest por email.
- **Métricas reales de plataformas**: snapshots por versión y plataforma, candidata a ganadora, agregados en Aprendizajes y señal de hook en ejemplares.

## Backlog restante (orden sugerido)

1. **Swipe file / clipper.** Pegar un ad/hook visto en redes → se guarda como `reference` etiquetado con ángulo detectado → alimenta la taxonomía de ganchos con ejemplos frescos del mercado local.
2. **Alertas de competencia.** Variante del radar con queries por marcas competidoras del cliente (definidas en el perfil de marca) — avisa cuando un competidor lanza algo.
3. **A/B tracker de hooks.** Los 10 hooks del Hook Lab exportables como matriz de test (CSV/Sheet) con columna de resultados; al volcar resultados, el ángulo ganador se registra como aprendizaje del rubro.
4. **TTS para borrador de VO.** Botón "escuchar" en el guion (ElevenLabs/OpenAI TTS) para validar ritmo hablado antes de grabar. Barato y muy útil para reels.
5. **Multi-tenant/roles.** Hoy hay un solo password de admin; si el equipo crece: tabla users + roles (editor/aprobador) — el pipeline de aprobación de aprendizajes ya lo insinúa.

## Reglas de mantenimiento del motor

- Corpus: versionar con tags `corpus-v2`, `corpus-v3` (nunca editar in-place los `corpus-v1` sembrados; el seed no pisa ediciones).
- Bloque 1 cacheado: cada edición de frameworks/corpus/preferencias invalida el caché una vez — agrupar cambios.
- Modelos free de OpenRouter: piso de contexto en 60k (`src/lib/ai/openrouter.ts`); si el pool se achica, revisar ese filtro.
- Schemas de salida estructurada: sin `minimum`/`maximum` — enums y validación Zod en el borde.
