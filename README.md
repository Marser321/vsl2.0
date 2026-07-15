# VSL Studio — AD Media Solution

Sistema de relevamiento, biblioteca y generación de guiones VSL. Organiza el contexto como **cliente → marca → oferta → campaña**, permite que el cliente complete un dossier mediante un enlace seguro y exige revisión humana antes de redactar.

## Funcionalidades

- Wizard público adaptativo con ocho pasos, autosave y recuperación de sesión.
- Enlaces secretos de 32 bytes, almacenados como hash, revocables y con vencimiento de 30 días.
- Revisión humana: `draft → submitted → in_review → approved` o `changes_requested`.
- Imágenes y documentos en un bucket privado de Supabase; URLs con extracción best effort y protección SSRF.
- OCR/visión de imágenes con OpenRouter y alternativa Anthropic para imágenes o PDFs escaneados.
- Dossiers persistentes de marca y oferta, campañas específicas y snapshot del contexto usado por cada VSL.
- Aprendizajes anonimizados por rubro, siempre pendientes de aprobación antes de cruzar entre clientes.
- OpenRouter 5+1 prioritario y Anthropic opcional, streaming, versiones, Hook Lab, crítica y teleprompter.
- Importación de referencias públicas de YouTube, Instagram y TikTok con subtítulos normales/automáticos, audio por OpenRouter y Groq opcional, y upload privado como respaldo.

## Requisitos

- Node.js 20.9 o superior.
- Proyecto Supabase con Postgres y Storage.
- Una clave de al menos uno de los proveedores de IA existentes.
- Resend es opcional en desarrollo, pero necesario para avisos por email.

## Configuración local

```bash
npm install
cp .env.example .env.local
```

Completá `.env.local`. La conexión `DATABASE_URL` debe usar el pooler de Supabase para el runtime serverless.

Generá el hash de la clave compartida:

```bash
node -e "require('argon2').hash('TU_CLAVE').then(console.log)"
```

Generá `SESSION_SECRET` y `AUTH_RATE_LIMIT_SALT` con valores aleatorios independientes de al menos 32 caracteres.

### Variables de entorno para automatizaciones

- `CRON_SECRET`: protege el radar semanal invocado por Vercel Cron. Generá uno con `openssl rand -hex 32`.
- `INTAKE_NOTIFICATION_EMAIL`: destinatario de los avisos de relevamientos y del resumen semanal del radar.
- `NEXT_PUBLIC_APP_URL`: URL pública de VSL Studio usada en los enlaces de los emails.
- `OPENROUTER_TRANSCRIPTION_MODEL`: modelo multimodal para audio; por defecto `nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free`.
- `TRANSCRIPTION_PROVIDER`: `auto` intenta OpenRouter primero y usa Groq solo si está configurado y OpenRouter falla; también admite `openrouter` o `groq`.
- `GROQ_API_KEY`: respaldo opcional para audio con `whisper-large-v3-turbo`; no se necesita para URLs con subtítulos públicos.
- OpenRouter exige tener al menos USD 0,50 cargados en la cuenta para habilitar entradas de audio, incluso cuando el modelo elegido no cobra tokens. Es un saldo mínimo de activación, no una dependencia de OpenAI.
- `YT_DLP_VERSION`: opcional; fija la release del binario autónomo que instala `postinstall`.

En producción, `NEXT_PUBLIC_APP_URL` debe ser HTTPS y apuntar al dominio público estable, no a localhost ni a un preview protegido. El dominio puede dejar la interfaz pública de relevamientos accesible mientras `REQUIRE_AUTH=true` protege el área interna desde la propia aplicación.

El radar corre los lunes a las 08:00 UTC (05:00 en Montevideo); los cron de Vercel siempre usan UTC.

## Base de datos

Aplicar migraciones y datos iniciales:

```bash
npm run db:migrate
npm run db:seed
```

La primera migración:

- crea las tablas Postgres;
- habilita RLS sin políticas públicas;
- crea el bucket privado `intake-assets` con tipos y tamaño permitidos.

El servidor accede mediante `DATABASE_URL`/service role. El navegador solo recibe tokens de upload firmados y nunca una clave privilegiada.

### Importar el SQLite anterior

Con `data/vsl.db` presente:

```bash
npm run db:import-sqlite
```

El script es idempotente, conserva IDs y relaciones, migra configuraciones, clientes, documentos, guiones y versiones, sube originales existentes al bucket y reajusta las secuencias Postgres. Al finalizar imprime los conteos importados para compararlos.

## Desarrollo y validación

```bash
npm run dev
npm test
npm run build
```

Pruebas E2E contra una base de prueba:

```bash
E2E_BASE_URL=http://localhost:3000 \
E2E_INTAKE_URL='http://localhost:3000/api/intakes/access?token=…' \
npm run test:e2e
```

`npm run smoke:ai` valida las APIs de IA configuradas.

## Flujo operativo

1. Crear primero el cliente en **Clientes**.
2. Crear un enlace desde **Relevamientos** y enviarlo al contacto.
3. El cliente puede guardar y retomar hasta enviar.
4. El equipo recibe el aviso, inicia la revisión y bloquea la edición.
5. Si faltan datos, selecciona **Pedir cambios** y el enlace vuelve a habilitarse por 30 días.
6. Al aprobar se crean/actualizan marca y oferta, se crea la campaña y se promueven las fuentes listas a la biblioteca privada.
7. **Generar VSL** abre el wizard interno con el brief de campaña prellenado.

## Privacidad del contexto

- Documentos, testimonios, URLs, claims y respuestas pertenecen a un cliente.
- El constructor rechaza documentos seleccionados que no sean globales ni pertenezcan al cliente actual.
- Solo los aprendizajes anonimizados y aprobados se comparten con marcas del mismo rubro.
- Cada versión registra IDs de documentos y la jerarquía de marca/oferta/campaña utilizada.

## Despliegue

1. Crear el proyecto Supabase y ejecutar migraciones/seed.
2. Verificar el dominio emisor en Resend para dejar de usar `onboarding@resend.dev`.
3. Importar el repositorio en Vercel.
4. Configurar todas las variables de `.env.example` en Preview y Production.
5. Desplegar Preview, ejecutar tests E2E y recién entonces promover el mismo artefacto.

Vercel Hobby sirve únicamente para el piloto interno. Antes del uso comercial regular debe utilizarse un plan compatible y verificarse que la generación 5+1 termine dentro del límite de función contratado.

## Stack

Next.js 16 · React 19.2 · TypeScript · Tailwind 4 · Supabase Postgres/Storage · Drizzle ORM · Resend · Anthropic SDK · OpenRouter · Groq opcional · Zod · Vitest · Playwright.
