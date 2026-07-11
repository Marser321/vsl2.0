# Brief: Pase visual y de marca — VSL Studio (AD Media Solution)

> **Para el agente ejecutor (GPT/Codex):** este brief es autocontenido. No tenés acceso a la conversación que lo originó. Todo lo que necesitás está acá. Leé COMPLETA la sección "Restricciones técnicas" antes de tocar código.

## Qué es esta app

VSL Studio es la herramienta interna de **AD Media Solution** (agencia de marketing, es-LATAM) para generar guiones de VSL y reels verticales con IA. Next.js 16 App Router + Tailwind 4 + Drizzle/Postgres. La app es funcional y estable; tu trabajo es **exclusivamente visual/presentacional**: que se vea profesional y con marca, sin tocar lógica.

## Objetivo del pase

1. Iconografía real y consistente (hoy hay glifos Unicode y emojis improvisados).
2. Marca AD Media Solution presente y cuidada (wordmark, favicon, tokens).
3. Consistencia visual: estados vacíos, colores de estado, responsive.
4. Nada de rediseños estructurales: misma información, misma jerarquía, mejor ejecución.

## Restricciones técnicas (LEER PRIMERO)

- **Next.js 16.2.10** — difiere de tu entrenamiento. Ante CUALQUIER duda de convención, leé `node_modules/next/dist/docs/` (especialmente `01-app/02-guides/upgrading/version-16.md`). Claves:
  - `params`/`searchParams` son **Promises**: `await params` en route handlers, `use(params)` en client components. Ya está todo migrado — no lo rompas.
  - El middleware se llama **`src/proxy.ts`** (no crear `middleware.ts`).
  - Turbopack es el default; **no** agregues config de webpack.
  - `next lint` no existe; verificá con `npm run build` y `npx tsc --noEmit`.
- **Tailwind 4, config CSS-first**: NO hay `tailwind.config.*` y no debés crearlo. Los tokens viven en `src/app/globals.css` bajo `@theme inline`. Los colores de marca son variables CSS en `:root`.
- **React 19**. Componentes de página son `"use client"` casi todos.
- Español rioplatense en todos los textos de UI (voseo: "creá", "generá"). Mantener.

## Marca

- Paleta actual (en `globals.css`): `--brand-sky #81e7ff`, `--brand-blue #488eff` (primario), `--brand-navy #01327f` (sidebar/títulos), `--brand-ink #2e3033`, `--brand-mist #f3fafd`, `--brand-white #fefefe`.
- Wordmark actual: texto `ad·` (punto en sky) + "VSL Studio / AD Media Solution" en `src/components/AppShell.tsx` y `src/app/login/page.tsx`. No hay assets de logo — si creás uno, que sea SVG inline propio (no descargues nada).
- Tono visual deseado: herramienta pro de agencia — sobria, azules de marca, mucho blanco, acentos sky. Nada de gradientes ruidosos ni glassmorphism.

## Tareas (en orden de impacto)

### 1. Iconografía → lucide-react
- `npm install lucide-react` (única dependencia nueva permitida).
- Reemplazar los glifos del nav en `AppShell.tsx` (`◉ ◇ ✦ ▤ ≣ ◫ ❏ ⌁ ◎ ⚙`) por iconos lucide semánticos (Home, ClipboardList, Sparkles, LayoutTemplate, ScrollText, Users, Library, Brain, Radar/ScanSearch, Settings), tamaño 16-18, `strokeWidth 1.75`.
- Reemplazar emojis/glifos en botones y títulos de paneles: `▶` (Play), `⬇` (Download), `★` (Star), `✎` (Pencil), `▤` (LayoutTemplate), `✦` (Sparkles), `🧪` (FlaskConical), `🎯` (Target), `📚` (BookOpen), `⚡` (Zap), `📊` (BarChart3), `🧠` (Brain), `◎` (Radar), `🎬` (Clapperboard), `📱` (Smartphone). Buscalos con grep en `src/app/**` y `src/components/**`.
- Los iconos dentro de botones: alineados con `inline-flex items-center gap-2` (los botones ya lo tienen).

### 2. Wordmark + favicon
- Componente `src/components/Brandmark.tsx`: el wordmark `ad·` como SVG/texto estilizado reutilizable (props: tamaño, variante clara/oscura). Usarlo en AppShell y login.
- Favicon real: reemplazar `src/app/favicon.ico` generando un SVG simple (cuadrado navy con `ad·` o la inicial) — Next 16 soporta `src/app/icon.svg`. Borrá los SVG de scaffolding sin uso en `public/` (`next.svg`, `vercel.svg`, `globe.svg`, `file.svg`, `window.svg`) tras confirmar con grep que nadie los referencia.

### 3. Tokens y colores de estado
- En `globals.css`: `--brand-white` está definido pero NO mapeado en `@theme inline` → agregarlo (`--color-brand-white`).
- Definir tokens de estado en `@theme inline`: éxito/peligro/aviso hoy usan `emerald-*`/`rose-*`/`amber-*` hardcodeados. Crear `--color-ok-*`, `--color-warn-*`, `--color-danger-*` (pueden apuntar a los mismos valores emerald/rose/amber) y migrar los usos EN COMPONENTES COMPARTIDOS (`ui.tsx` Badge tones). En páginas individuales, migrá solo si el cambio es mecánico y seguro.
- `<html>` en `src/app/layout.tsx`: agregar `data-scroll-behavior="smooth"` (Next 16 lo requiere para scroll suave en navegación).

### 4. Responsive
- Grids fijos que rompen en pantallas chicas: `grid-cols-4` (stats en `src/app/page.tsx`), `grid-cols-2/3` (formularios en `generar/page.tsx`, cards en `clientes/page.tsx`, `plantillas/page.tsx`). Agregar breakpoints (`grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` etc.).
- El sidebar (`AppShell`) puede quedar fijo — la app es de escritorio primero — pero que no desborde en 1024px.

### 5. Estados vacíos y pulido puntual
- Unificar estados vacíos (hoy: texto suelto slate-400): icono lucide grande suave + título corto + acción sugerida. Páginas: `/guiones`, `/plantillas`, `/clientes`, `/biblioteca`, `/aprendizajes`, dashboard.
- Login (`src/app/login/page.tsx`): centrado, wordmark nuevo, sombra suave, fondo `brand-mist`.
- `ScriptEditor` (`src/components/ScriptEditor.tsx`): la barra de estado inferior y los tabs Editar/Vista previa pueden ganar altura de línea y separación; NO cambiar su lógica (atajos, borradores, estados) — solo clases.
- Focus visible: asegurar `focus-visible:ring` coherente en botones/links del design system (`src/components/ui.tsx`).

## Archivos principales de UI

- Design system: `src/components/ui.tsx` (Card, PageTitle, Badge, btnPrimary/btnSecondary/inputCls, KIND_LABELS/TONES, FORMAT_LABELS/TONES)
- Shell/nav: `src/components/AppShell.tsx` · Global CSS: `src/app/globals.css` · Layout: `src/app/layout.tsx`
- Páginas: `src/app/{page,login/page,clientes/page,clientes/[id]/page,generar/page,plantillas/page,guiones/page,guiones/[id]/page,guiones/[id]/teleprompter/page,biblioteca/page,aprendizajes/page,analizador/page,configuracion/page,relevamientos/page,relevamientos/[id]/page}.tsx`
- Componentes: `ScriptEditor.tsx`, `RatingWidget.tsx`, `ScriptMarkdown.tsx`, `HookLab.tsx`, `CritiquePanel.tsx`, `LearningsPanel.tsx`, `DocumentManager.tsx`, `intake/IntakeWizard.tsx`

## NO TOCAR (romperías el producto)

- `src/lib/**` (motor de IA, contexto, radar, versiones, plantillas) — excepción: NINGUNA.
- `src/db/**`, `drizzle/**`, `src/proxy.ts`, `src/app/api/**` (lógica de rutas).
- La lógica/estado de ningún componente: solo className, markup presentacional, iconos y textos de UI equivalentes.
- No agregues dependencias más allá de `lucide-react`. No toques `package.json` scripts ni configs.
- El wizard público `/relevamiento/[publicId]` (IntakeWizard): solo ajustes de bajo riesgo (iconos, espaciado) — lo usan clientes externos.

## Criterios de aceptación

1. `npx tsc --noEmit` y `npm run build` en verde; `npm test` en verde (no tocaste lógica, deben pasar solos).
2. Cero emojis/glifos Unicode como iconos en nav y botones (los emojis dentro de TEXTOS de guiones generados no cuentan).
3. Favicon y wordmark de marca visibles; scaffolding de Next eliminado de `public/`.
4. Dashboard, generar (los 5 pasos), detalle de guion (con editor abierto), plantillas y login se ven correctos en 1280px y 1024px, y el body nunca scrollea horizontal.
5. Un commit por bloque de tareas (1-5), mensajes en español.

## Verificación manual mínima

`npm run dev` → recorrer: login → dashboard → generar (paso a paso hasta el brief, sin generar) → guiones → detalle de un guion → "Editar guion" (abrir y cerrar) → plantillas (vista previa) → aprendizajes → configuración. En cada pantalla: iconos consistentes, sin overflow, estados vacíos correctos.
