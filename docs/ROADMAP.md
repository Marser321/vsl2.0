# Roadmap — VSL Studio

Estado al 2026-07-11 (auditoría del mismo día: core completo, sin stubs; briefs ejecutables escritos para el pase visual y los ítems 1–4 del backlog). Lo construido y el backlog de ideas laterales priorizado.

## Hecho (julio 2026)

- **Corpus fundacional** (`npm run db:seed-corpus`): 12 docs de doctrina original en español (ecuación de valor estilo Hormozi, VSL clásico estilo Benson, mensaje 4 partes estilo Suby, gancho-historia-oferta estilo Brunson, reglas de oro VSL, playbook de reels, taxonomía de 10 ganchos, objeciones/precio, niveles de conciencia, 3 desgloses estructurales beat-a-beat) + 5 frameworks de reel + 5 plantillas builtin. Entra al Bloque 1 cacheado de todas las generaciones (~8k tokens).
- **Formato Reel** (15–90s): paso "Formato" en el wizard, contrato de salida en segundos con `[TEXTO EN PANTALLA]`, hooks reel-aware, badges.
- **Editor manual**: edición directa del guion con coalescing de versiones, Cmd+S, borrador local, contador de duración, checklist de marcadores `{{ }}`, "Aplicar en editor" desde la crítica.
- **Puntuación 1-5★ por versión** con tags de factores → alimenta: ranking de ejemplares promovidos (los ≤2★ se destildan del contexto), stats por framework/proveedor/formato con chip "Recomendado" en el wizard, doc regenerable `[AUTO] Preferencias aprendidas del equipo` (Bloque 1), extracción de anti-patrones a `industry_learnings`.
- **Plantillas**: 5 builtin + "guardar como plantilla"; usar plantilla → aterriza en el editor con placeholders resueltos por cliente.
- **Radar de tendencias MVP**: botón por cliente → Google News RSS del rubro (sin API keys) → 3-5 ángulos de oportunidad con ventana temporal → doc `[RADAR]` que entra sugerido al wizard.
- **Pase visual pendiente de ejecutar por GPT**: brief autocontenido **v2** en `docs/briefs/gpt-pase-visual.md` (correr sobre main estable). La v2 amplía el alcance: design system real (Button/Input/EmptyState/Table/ConfirmDialog), toasts con sonner, `loading.tsx`/`error.tsx`/`not-found.tsx`, eliminación de `alert()`/`confirm()`/`prompt()`, fix del bug cargando-vs-vacío, responsive y marca/metadata. **Es el pendiente prioritario.**

## Backlog de ideas laterales (orden sugerido)

1. **Métricas reales de plataformas → ratings automáticos.** Pegar stats de Meta/TikTok (retención 3s, CTR, CPA) en el guion; convertirlas en señal dura que complemente las ★ del equipo. La versión con mejores métricas reales se auto-promueve como candidata a ganadora. *Por qué: cierra el loop con datos de mercado, no solo criterio interno.* → **Brief listo: `docs/briefs/gpt-metricas-reales.md`.**
2. **Importador de transcripts de YouTube en el Analizador.** La extracción de captions ya existe (`src/lib/ingest/url.ts` extrae `captionTracks`); falta exponerla en `/analizador` (pegar URL → transcript → análisis estructural → biblioteca). *Esfuerzo bajo, la mitad del código ya está.* → **Brief listo: `docs/briefs/gpt-analizador-youtube.md`.**
3. **Reescritura guiada por mapa de retención.** En el teleprompter ya se detectan fugas heurísticas; agregar "corregir esta sección con IA" que mande la sección + flag al refinador. *Une dos features existentes.* → **Brief listo: `docs/briefs/gpt-reescritura-retencion.md`.**
4. **Radar programado (cron semanal).** El radar hoy es manual; un cron (Vercel Cron → route handler) lo corre lunes temprano para todos los clientes con industria definida y avisa por email (Resend ya está integrado). → **Brief listo: `docs/briefs/gpt-radar-cron.md`.**
5. **Swipe file / clipper.** Pegar un ad/hook visto en redes → se guarda como `reference` etiquetado con ángulo detectado → alimenta la taxonomía de ganchos con ejemplos frescos del mercado local.
6. **Alertas de competencia.** Variante del radar con queries por marcas competidoras del cliente (definidas en el perfil de marca) — avisa cuando un competidor lanza algo.
7. **A/B tracker de hooks.** Los 10 hooks del Hook Lab exportables como matriz de test (CSV/Sheet) con columna de resultados; al volcar resultados, el ángulo ganador se registra como aprendizaje del rubro.
8. **TTS para borrador de VO.** Botón "escuchar" en el guion (ElevenLabs/OpenAI TTS) para validar ritmo hablado antes de grabar. Barato y muy útil para reels.
9. **Multi-tenant/roles.** Hoy hay un solo password de admin; si el equipo crece: tabla users + roles (editor/aprobador) — el pipeline de aprobación de aprendizajes ya lo insinúa.

## Reglas de mantenimiento del motor

- Corpus: versionar con tags `corpus-v2`, `corpus-v3` (nunca editar in-place los `corpus-v1` sembrados; el seed no pisa ediciones).
- Bloque 1 cacheado: cada edición de frameworks/corpus/preferencias invalida el caché una vez — agrupar cambios.
- Modelos free de OpenRouter: piso de contexto en 60k (`src/lib/ai/openrouter.ts`); si el pool se achica, revisar ese filtro.
- Schemas de salida estructurada: sin `minimum`/`maximum` — enums y validación Zod en el borde.
