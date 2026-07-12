# Brief v2: Pase visual y de profesionalización — VSL Studio (AD Media Solution)

> **Para el agente ejecutor (GPT/Codex):** este brief es autocontenido. No tenés acceso a la conversación que lo originó. Todo lo que necesitás está acá. Leé COMPLETA la sección "Restricciones técnicas" antes de tocar código. Esta v2 reemplaza al brief anterior de "pase visual" (que nunca se ejecutó) y amplía su alcance: además de iconografía y marca, incluye un design system real, estados de carga/error por ruta, y la eliminación de los `alert()`/`confirm()`/`prompt()` nativos.

## Qué es esta app

VSL Studio es la herramienta interna de **AD Media Solution** (agencia de marketing, es-LATAM) para generar guiones de VSL y reels verticales con IA. Next.js 16 App Router + Tailwind 4 + Drizzle/Postgres. La app es funcional y estable; tu trabajo es **visual y de presentación**: que se vea y se sienta como una herramienta profesional de agencia. Podés crear componentes de UI nuevos con estado local mínimo (dialogs, toasts), pero **no** tocar lógica de negocio, fetching, ni endpoints.

## Objetivo del pase

1. Iconografía real y consistente (hoy hay glifos Unicode y emojis improvisados).
2. Marca AD Media Solution presente y cuidada (wordmark, favicon, metadata).
3. Un design system real: componentes `Button`/`Input`/`EmptyState`/`Table`/`ConfirmDialog`/toasts en vez de strings de clases sueltas.
4. Estados de carga, error y vacío bien diseñados en todas las rutas (hoy: texto plano "Cargando…", y varias páginas muestran "no hay datos" mientras cargan).
5. Cero `alert()`/`confirm()`/`prompt()` nativos del navegador.
6. Responsive correcto en el panel (hoy hay grids fijos que rompen bajo 1280px).
7. Nada de rediseños estructurales: misma información, misma jerarquía, mejor ejecución.

## Restricciones técnicas (LEER PRIMERO)

- **Next.js 16.2.10** — difiere de tu entrenamiento. Ante CUALQUIER duda de convención, leé `node_modules/next/dist/docs/` (especialmente `01-app/02-guides/upgrading/version-16.md`). Claves:
  - `params`/`searchParams` son **Promises**: `await params` en route handlers y server components, `use(params)` en client components. Ya está todo migrado — no lo rompas.
  - El middleware se llama **`src/proxy.ts`** (no crear `middleware.ts`).
  - Turbopack es el default; **no** agregues config de webpack.
  - `next lint` no existe; verificá con `npm run build` y `npx tsc --noEmit`.
  - Sí existen y DEBÉS usar las convenciones de App Router: `loading.tsx`, `error.tsx`, `not-found.tsx`, `src/app/icon.svg` (favicon automático), Metadata API en `layout.tsx`.
- **Tailwind 4, config CSS-first**: NO hay `tailwind.config.*` y no debés crearlo. Los tokens viven en `src/app/globals.css` bajo `@theme inline`. Los colores de marca son variables CSS en `:root`.
- **React 19**. Las páginas del panel son `"use client"` casi todas; el dashboard (`src/app/page.tsx`) es server component.
- Español rioplatense en todos los textos de UI (voseo: "creá", "generá"). Mantener.
- **Dependencias nuevas permitidas: SOLO `lucide-react` y `sonner`.** Nada más (`npm install lucide-react sonner`). No agregues Radix, shadcn, framer-motion ni ninguna otra.

## Marca

- Paleta actual (en `globals.css`): `--brand-sky #81e7ff`, `--brand-blue #488eff` (primario), `--brand-navy #01327f` (sidebar/títulos), `--brand-ink #2e3033`, `--brand-mist #f3fafd`, `--brand-white #fefefe`.
- Wordmark actual: texto `ad·` (punto en sky) + "VSL Studio / AD Media Solution", hardcodeado en `src/components/AppShell.tsx`, `src/app/login/page.tsx` y `src/components/intake/IntakeWizard.tsx` (PublicFrame). No hay assets de logo — si creás uno, que sea SVG inline propio (no descargues nada).
- Tipografía: Geist (ya cargada vía `next/font` en `layout.tsx`).
- Tono visual deseado: herramienta pro de agencia — sobria, azules de marca, mucho blanco, acentos sky. Nada de gradientes ruidosos ni glassmorphism.

---

## Fases (cada una = commits propios; ejecutalas EN ORDEN)

### Fase 0 — Marca y metadata

1. `npm install lucide-react sonner`.
2. **Iconografía → lucide-react.** Reemplazar TODOS los glifos/emojis usados como iconos de UI:
   - Nav en `AppShell.tsx` (`◉ ◇ ✦ ▤ ≣ ◫ ❏ ⌁ ◎ ⚙`) → iconos lucide semánticos (Home, ClipboardList, Sparkles, LayoutTemplate, ScrollText, Users, Library, Brain, Radar o ScanSearch, Settings), tamaño 16–18, `strokeWidth={1.75}`.
   - Botones y títulos de paneles: `▶` (Play), `⏸` (Pause), `⬇` (Download), `★` (Star), `✎` (Pencil), `▤` (LayoutTemplate), `✦` (Sparkles), `🧪` (FlaskConical), `🎯` (Target), `📚` (BookOpen), `⚡` (Zap), `📊` (BarChart3), `🧠` (Brain), `◎` (Radar), `🎬` (Clapperboard), `📱` (Smartphone), `🔬` (Microscope, en `src/app/analizador/page.tsx:127`), `⚠` (AlertTriangle, en el teleprompter), `✓` (Check), `←` (ArrowLeft). Buscalos con grep en `src/app/**` y `src/components/**`.
   - Los iconos dentro de botones: los botones ya tienen `inline-flex items-center gap-2`, alinean solos.
   - Los emojis dentro de TEXTOS de guiones generados o contenido de corpus NO cuentan — no toques contenido, solo UI.
3. **Wordmark:** componente `src/components/Brandmark.tsx` — el `ad·` como SVG/texto estilizado reutilizable (props: `size`, `variant: "light" | "dark"`). Usarlo en `AppShell.tsx`, `login/page.tsx` y el `PublicFrame` de `IntakeWizard.tsx` (en este último, cambio mínimo: solo sustituir el logo).
4. **Favicon:** crear `src/app/icon.svg` (cuadrado navy `#01327f` con `ad·` o la inicial en blanco/sky) y borrar `src/app/favicon.ico`. Next 16 genera el favicon desde `icon.svg` automáticamente.
5. **Limpiar `public/`:** borrar `next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg` tras confirmar con grep que nadie los referencia.
6. **Metadata en `src/app/layout.tsx`:** description real en español ("Estudio de guiones VSL y reels con IA de AD Media Solution" o similar), `themeColor: "#01327f"`, `openGraph` básico (title, description, siteName, locale `es_UY`). Agregar `data-scroll-behavior="smooth"` al `<html>` (Next 16 lo requiere para scroll suave en navegación).

### Fase 1 — Design system real

Crear `src/components/ui/` con estos componentes, y convertir `src/components/ui.tsx` en una fachada que re-exporta todo desde ahí (así NO se rompe ningún import existente `from "@/components/ui"`):

1. **`Button`** — variantes `primary | secondary | danger | ghost`, props `icon?: ReactNode`, `loading?: boolean` (muestra spinner y deshabilita), `size?: "sm" | "md"`. Base visual: las clases actuales de `btnPrimary`/`btnSecondary` en `ui.tsx` (mantener ese look). `btnPrimary`/`btnSecondary`/`inputCls` siguen exportados (los usan muchas páginas) pero pasan a derivarse de las mismas constantes que usa `Button`.
2. **`Input`, `Textarea`, `Select`** — el estilo de `inputCls` actual. Y **`Field`** — wrapper con `label`, `error?`, `hint?` (el patrón `<label className="block text-xs font-semibold text-slate-600 mb-1">` que hoy se repite a mano en todas las páginas).
3. **`EmptyState`** — props `icon` (componente lucide), `title`, `description?`, `action?` (ReactNode). Icono grande suave (`size 40, text-slate-300`), título corto, acción sugerida. Reemplaza los textos sueltos `text-slate-400` de páginas vacías.
4. **`Skeleton`** — bloque `animate-pulse bg-slate-100 rounded` con `className` para dimensionar. Y **`Spinner`** — SVG circular chico para botones.
5. **`Table`** — wrapper con `overflow-x-auto`, `<thead>` estilado (texto xs uppercase slate-500, borde inferior), filas con `border-t` y hover suave. Reemplaza las tablas crudas de `src/app/aprendizajes/page.tsx`.
6. **`ConfirmDialog`** — sobre el elemento nativo `<dialog>` (sin Radix): título, mensaje, botón confirmar (variante danger cuando destruye) y cancelar. API sugerida: componente controlado (`open`, `onConfirm`, `onClose`) — simple y suficiente.
7. **Toasts:** `sonner`. Montar `<Toaster position="bottom-right" richColors />` en `src/app/layout.tsx`. Uso: `toast.success("Guardado")`, `toast.error(mensaje)`.
8. **Tokens de estado en `globals.css`:** `--brand-white` está definido pero NO mapeado en `@theme inline` → agregarlo (`--color-brand-white`). Definir tokens de estado `--color-ok-*`, `--color-warn-*`, `--color-danger-*` (pueden apuntar a los valores emerald/rose/amber que ya se usan) y migrar los tonos del `Badge` a esos tokens. En páginas individuales, migrá colores solo si el cambio es mecánico y seguro.
9. **Focus visible:** `focus-visible:ring-2 focus-visible:ring-brand-blue/40` coherente en `Button` y links de nav.

### Fase 2 — Estados por ruta (loading / error / 404)

1. **`loading.tsx`** con skeletons que imiten el layout real de cada página (usar `Skeleton`): `src/app/loading.tsx` (dashboard: 4 stat-cards + lista), y `loading.tsx` en `guiones/`, `clientes/`, `plantillas/`, `aprendizajes/`, `relevamientos/`. Nota: las páginas client-side no disparan `loading.tsx` en fetch interno — para esas, ver punto 3.
2. **`src/app/error.tsx`** (client component con `reset()`: mensaje amable + botón "Reintentar") y **`src/app/not-found.tsx`** (Brandmark + "Esta página no existe" + link al dashboard).
3. **Arreglar el bug cargando-vs-vacío:** en `src/app/guiones/page.tsx` y `src/app/clientes/page.tsx` el estado inicial `[]` hace que se muestre "Todavía no hay…" mientras el fetch está en vuelo. Agregar estado `loading` explícito (`useState(true)` → `false` al resolver) y mostrar skeletons mientras carga; `EmptyState` SOLO cuando `!loading && rows.length === 0`. Revisar el mismo patrón en `plantillas/page.tsx`, `aprendizajes/page.tsx`, `relevamientos/page.tsx`, `configuracion/page.tsx` y `clientes/[id]/page.tsx` (los "Cargando…" de texto plano → skeleton o spinner con layout).
4. Migrar los estados vacíos existentes a `EmptyState` con icono lucide: `/guiones`, `/plantillas` (conservar la instrucción `npm run db:seed-corpus`), `/clientes`, `/biblioteca` (dentro de `DocumentManager`), `/aprendizajes`, dashboard.

### Fase 3 — Matar `alert()` / `confirm()` / `prompt()`

Sitios exactos (verificá con `grep -rn "alert(\|confirm(\|prompt(" src/`):

- `src/app/guiones/[id]/page.tsx` (~líneas 179 y 195): el `prompt()` del nombre al guardar como plantilla → `ConfirmDialog` con un `Input` adentro (o mini-form inline); los `alert()` de resultado → `toast.success` / `toast.error`.
- `src/app/plantillas/page.tsx`: `confirm()` al eliminar plantilla → `ConfirmDialog` variante danger.
- `src/app/aprendizajes/page.tsx`: `confirm()` → `ConfirmDialog`.
- `src/components/DocumentManager.tsx`: `confirm()` al borrar documento → `ConfirmDialog`; avisos → toast.

Además: los feedbacks inline tipo "✓ Guardado" que desaparecen solos pueden quedarse; los errores de fetch que hoy solo se ven en un banner pueden ADEMÁS emitir `toast.error` si el banner queda fuera de viewport. No cambies la lógica de los handlers — solo el mecanismo de confirmación/aviso.

### Fase 4 — Responsive y pulido por página

1. **Grids fijos → breakpoints** (la app es desktop-first, pero no puede romper en 1024px ni en tablet):
   - `src/app/page.tsx`: stats `grid-cols-4` → `grid-cols-2 lg:grid-cols-4`.
   - `src/app/generar/page.tsx`: `grid-cols-2/3` → `grid-cols-1 sm:grid-cols-2` / `sm:grid-cols-3`.
   - `src/app/clientes/page.tsx`: cards `grid-cols-3` → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`.
   - `src/app/plantillas/page.tsx`: ídem.
   - `src/app/analizador/page.tsx`, `src/app/configuracion/page.tsx`, `src/app/clientes/[id]/page.tsx`: revisar `grid-cols-2` fijos.
   - El sidebar (`AppShell`) puede quedar fijo `w-60` — pero verificá que a 1024px el contenido no desborde (el `<main>` tiene `p-8`; podés bajarlo a `p-4 lg:p-8`).
2. **Tablas de `aprendizajes/page.tsx`** → componente `Table` nuevo (thead, zebra, hover).
3. **Login (`src/app/login/page.tsx`):** fondo `bg-brand-mist`, `Brandmark`, migrar el input a `Field`/`Input` del design system.
4. **`IntakeWizard.tsx` (wizard público — lo usan clientes externos, riesgo bajo solamente):** permitido: Brandmark, iconos lucide, y unificar `FieldInput` con las mismas clases del `Input` del design system. NO tocar su lógica de autosave/navegación/subida de archivos.
5. **`ScriptEditor.tsx`:** solo clases — la barra de estado inferior y los tabs Editar/Vista previa pueden ganar altura de línea y separación. NO cambiar su lógica (atajos, borradores, coalescing).
6. Barrido final de consistencia: `accent-[#488eff]` hardcodeado en checkboxes (`generar/page.tsx`, `IntakeWizard.tsx`) → `accent-brand-blue`; paddings de cards dispares donde sea mecánico.

---

## Archivos principales de UI

- Design system: `src/components/ui.tsx` (Card, PageTitle, Badge, btnPrimary/btnSecondary/inputCls, KIND_LABELS/TONES, FORMAT_LABELS/TONES) → migra a `src/components/ui/` con fachada.
- Shell/nav: `src/components/AppShell.tsx` · Global CSS: `src/app/globals.css` · Layout: `src/app/layout.tsx`
- Páginas: `src/app/{page,login/page,clientes/page,clientes/[id]/page,generar/page,plantillas/page,guiones/page,guiones/[id]/page,guiones/[id]/teleprompter/page,biblioteca/page,aprendizajes/page,analizador/page,configuracion/page,relevamientos/page,relevamientos/[id]/page}.tsx`
- Componentes: `ScriptEditor.tsx`, `RatingWidget.tsx`, `ScriptMarkdown.tsx`, `HookLab.tsx`, `CritiquePanel.tsx`, `LearningsPanel.tsx`, `DocumentManager.tsx`, `intake/IntakeWizard.tsx`

## NO TOCAR (romperías el producto)

- `src/lib/**` (motor de IA, contexto, radar, versiones, plantillas) — excepción: NINGUNA.
- `src/db/**`, `drizzle/**`, `src/proxy.ts`, `src/app/api/**` (lógica de rutas).
- La lógica de negocio/fetching de ningún componente: podés agregar estado local de UI (abrir/cerrar dialog, flag `loading` de fetch ya existente) pero no cambiar qué se fetchea, cuándo, ni qué hacen los handlers.
- No toques `package.json` scripts ni configs (solo las 2 dependencias nuevas).
- El teleprompter (`guiones/[id]/teleprompter/page.tsx`): solo iconos y clases; su auto-scroll con `requestAnimationFrame` es delicado.

## Criterios de aceptación

1. `npx tsc --noEmit`, `npm run build` y `npm test` en verde (no tocaste lógica, deben pasar solos).
2. Cero emojis/glifos Unicode como iconos en nav, botones y títulos de paneles.
3. `grep -rn "alert(\|confirm(\|prompt(" src/` → cero resultados en código de UI.
4. Favicon y wordmark de marca visibles; scaffolding de Next eliminado de `public/`; metadata con description/OG/theme-color.
5. Toda ruta del panel tiene loading state que NO es texto plano (skeleton o spinner con layout), y ninguna página muestra su estado vacío mientras todavía está cargando.
6. Estados vacíos con `EmptyState` (icono + título + acción) en guiones, clientes, plantillas, biblioteca, aprendizajes y dashboard.
7. Tablas de aprendizajes con thead estilado y hover.
8. Dashboard, generar (los 5 pasos), detalle de guion (con editor abierto), plantillas, aprendizajes y login se ven correctos en 1280px, 1024px y 768px; el body nunca scrollea horizontal.
9. Un commit por fase (0–4), mensajes en español.

## Verificación manual mínima

`npm run dev` → recorrer: login → dashboard → generar (paso a paso hasta el brief, sin generar) → guiones (recargar y mirar el skeleton) → detalle de un guion → "Editar guion" (abrir y cerrar) → guardar como plantilla (ver dialog + toast) → plantillas (vista previa + eliminar con dialog) → aprendizajes (tablas) → configuración → una URL inexistente (404 con marca). En cada pantalla: iconos consistentes, sin overflow, estados de carga/vacío correctos. Repetir dashboard y generar con el viewport a 1024px y 768px.
