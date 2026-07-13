# Plan de testeo de flujos — VSL Studio

Objetivo: detectar problemas de flujo y de funcionamiento en la app, con foco en que **generar un guión se sienta fácil e intuitivo**. Este plan se ejecuta con la skill `/qa-flujos` (ver `.claude/skills/qa-flujos/SKILL.md`), que reparte las 5 misiones entre agentes en paralelo o las corre en secuencia.

**Regla de esta fase: solo detectar y reportar. No arreglar nada.**

## Contexto de la app

- Next.js (App Router) + Drizzle + Supabase Postgres. Código en `src/`.
- Flujo esperado: Cliente → Marca → Oferta → Campaña → Generar VSL (`/generar`, wizard de 5 pasos) → Editor (`/guiones/[id]`) → refinar/versionar/puntuar.
- Generación por SSE en `POST /api/generate` (providers: Anthropic, OpenAI, OpenRouter arnés 5+1). El guión se persiste recién al final del stream.
- Seeds requeridos: `npm run db:seed` (prompt maestro + frameworks) y `npm run db:seed-corpus`.

## Hipótesis a confirmar o descartar (de la exploración de código)

| ID | Hipótesis | Dónde mirar |
|----|-----------|-------------|
| H1 | `/configuracion` muere entera si falta `OPENROUTER_API_KEYS`: `src/app/api/settings/route.ts` importa estáticamente `key-rotator.ts`, que lanza al cargar el módulo | Abrir `/configuracion`, mirar respuesta de `/api/settings` |
| H2 | Si el SSE de `/api/generate` se corta sin evento `done` ni `error` (timeout `maxDuration=60`, red, arnés 5+1 lento), el wizard queda con texto parcial, sin error visible y sin guión guardado | `src/app/generar/page.tsx` ~L260–290 |
| H3 | El guión se inserta en DB solo al final del stream: cualquier corte pierde todo el contenido generado | `src/app/api/generate/route.ts` |
| H4 | Sin seeds no hay frameworks ni prompt maestro y el wizard queda inutilizable sin explicación | Paso "Framework" del wizard con DB sin seed |
| H5 | La cuota de OpenRouter se reserva antes de generar (`reserveEnsembleCalls`) y no se devuelve si la generación falla | `src/lib/ai/openrouter.ts`, setting `openrouter_quota_used` |
| H6 | El onboarding no comunica que hay que crear cliente→marca→oferta→campaña antes de generar; el usuario nuevo no sabe por dónde empezar | Home y `/generar` sin datos previos |

## Formato de hallazgo (obligatorio, idéntico en todas las misiones)

```markdown
### [M{misión}-{nro}] {título corto}
- **Severidad**: bloqueante | mayor | menor | pulido
- **Flujo**: {p. ej. "Generación de guión, paso 4"}
- **Pasos para reproducir**: 1) … 2) … 3) …
- **Esperado**: …
- **Observado**: …
- **Impacto en el usuario**: {en una frase, qué le pasa a alguien como Mario}
- **Evidencia**: {mensaje de error, respuesta HTTP, screenshot, log de consola}
- **Hipótesis relacionada**: H1–H6 o "nueva"
```

Severidades: **bloqueante** = impide completar el flujo; **mayor** = se completa pero con pérdida de datos, error confuso o desvío serio; **menor** = fricción o inconsistencia; **pulido** = detalle estético/copy.

---

## M1 — Camino crítico: generar un guión de punta a punta

*El flujo que falló en el uso real. Es la misión más importante.*

Precondición: DB con seeds, al menos una API key de LLM configurada.

1. **Arranque en frío**: entrar a `/` como usuario nuevo. ¿Queda claro cuál es el primer paso para llegar a un guión? (H6)
2. **Crear cliente**: ir a `/clientes`, crear un cliente de prueba ("QA Test Cliente"). ¿El formulario valida bien, confirma la creación, y ofrece el siguiente paso?
3. **Wizard `/generar`**: recorrer los 5 pasos (Formato → Cliente → Framework → Brief y documentos → Generación).
   - ¿Se puede avanzar sin completar campos obligatorios? ¿Los errores de validación son visibles y en español claro?
   - ¿El paso Framework muestra frameworks? (H4)
   - Completar un brief mínimo realista (producto, audiencia, oferta, dolores, CTA) y generar.
4. **Durante la generación**: ¿hay indicador de progreso? ¿El texto va apareciendo (streaming)? Cronometrar. Si supera ~60s, anotar qué pasa exactamente (H2).
5. **Final feliz**: al terminar, ¿navega automáticamente a `/guiones/[id]`? ¿El guión está completo y persistido (recargar la página)?
6. **Final infeliz**: si la generación falla o se corta, ¿el usuario ve un error accionable o queda colgado con texto parcial? ¿Se guardó algo? (H2, H3)
7. **Repetir con cada provider configurado** (Anthropic / OpenAI / OpenRouter) si hay claves; anotar diferencias de comportamiento y tiempos.

## M2 — Manejo de errores y estados vacíos

*Romper la app a propósito y ver si el usuario entendería qué pasó.*

1. `/configuracion`: abrir la página y mirar `/api/settings` en Network. (H1)
2. **Brief incompleto**: intentar generar con campos vacíos o mínimos; ¿la validación Zod llega al usuario como mensaje claro o como error 400 crudo?
3. **Sin framework**: generar con framework en null (es válido para el schema). ¿El resultado tiene sentido? ¿La UI avisa?
4. **Corte de stream**: iniciar una generación y cortar la red / cerrar-recargar la pestaña a mitad. ¿Qué ve el usuario al volver? ¿Quedó algo en DB o en cuota consumida? (H2, H3, H5)
5. **Estados vacíos**: visitar `/guiones`, `/clientes`, `/plantillas`, etc. sin datos. ¿Hay empty states con guía o pantallas en blanco?
6. **Endpoints directos**: probar `POST /api/generate` con payload inválido y sin sesión (si `REQUIRE_AUTH=true`); verificar códigos y mensajes.
7. **Doble submit**: apretar "Generar" dos veces rápido. ¿Se disparan dos generaciones (doble gasto de tokens)?

## M3 — UX e intuitividad de primera vez

*Recorrido heurístico como si nunca hubieras visto la app. La vara: "¿Mario puede llegar solo a su primer guión sin ayuda?"*

1. **Home**: ¿comunica qué es la app y cuál es la acción principal? ¿Hay un camino guiado o solo navegación? (H6)
2. **Nomenclatura**: ¿los términos (relevamientos, frameworks, briefs, campañas) son consistentes entre menú, páginas y botones?
3. **Dead-ends**: en cada página, ¿siempre hay un "siguiente paso" o botón de volver? Buscar callejones sin salida.
4. **Jerarquía cliente→marca→oferta→campaña**: ¿se puede generar salteándola? ¿La UI explica la relación o hay que adivinarla?
5. **Feedback**: tras cada acción (guardar, crear, borrar), ¿hay confirmación visible (toast/mensaje)? ¿Los botones muestran estado de carga?
6. **Responsive**: repetir el camino crítico en viewport móvil (375×812). ¿El wizard y el editor son usables?
7. **Accesibilidad rápida**: navegación por teclado en el wizard, foco visible, labels de inputs.

## M4 — Editor y post-generación

Precondición: al menos un guión generado (puede crearse vía M1 o insertando datos).

1. **Editar y guardar**: modificar el guión; ¿el autosave (localStorage) funciona tras recargar? ¿Guardar crea versión nueva correctamente (coalescing)?
2. **Versiones**: crear varias versiones, cambiar entre ellas, promover una. ¿Se pierde algo? ¿Está claro cuál es la activa?
3. **Refinar** (`/refine`, SSE): pedir un refinamiento; mismas verificaciones de streaming que M1.4–1.6.
4. **Rating**: puntuar 1–5★; ¿persiste y se refleja?
5. **Paneles**: HookLab, Critique, Learnings, Metrics — ¿cargan sin error, con datos y con estados vacíos?
6. **Teleprompter** (`/guiones/[id]/teleprompter`): ¿funciona con un guión largo?
7. **Copiar/exportar**: probar el clipboard/plantillas de salida.

## M5 — Datos y configuración

1. **CRUD completo** de clientes, marcas, ofertas y campañas: crear, editar, borrar. ¿Los borrados avisan de dependencias (guiones/campañas colgando)?
2. **Relevamientos/intake**: completar el formulario de intake, incluyendo subida de archivos al bucket. ¿Errores claros si falta algo?
3. **Brief autofill** (`POST /api/brief-autofill`): ¿funciona desde una campaña? ¿Qué pasa si falla el LLM?
4. **Documentos**: subir/asociar documentos y verificar que aparecen sugeridos en el wizard.
5. **Plantillas**: crear/aplicar una plantilla.
6. **`/configuracion`**: cambiar provider/modelo por defecto y verificar que la próxima generación lo respeta. (H1 primero)
7. **Importar URL** (`/api/analyze/import-url`): probar con una URL válida y una inválida.

---

## Notas para producción (segunda pasada, contra la URL desplegada)

- Foco en H1 y H2: en Vercel el `maxDuration=60` es real; cronometrar una generación completa con cada provider.
- Verificar que `REQUIRE_AUTH` esté activo (¿la app pide login?). Si no lo pide, reportar como hallazgo de seguridad **mayor**.
- No crear datos basura: prefijar todo con `QA-` y listarlo al final del reporte para limpieza.
- No agotar cuota de OpenRouter: máximo 1 generación con el arnés 5+1.
