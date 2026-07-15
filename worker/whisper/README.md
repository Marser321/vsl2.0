# Worker Whisper self-hosted

Transcripción gratuita y sin depender de saldo de terceros, sobre
[faster-whisper](https://github.com/SYSTRAN/faster-whisper) (Whisper reimplementado
con CTranslate2, ~4× más rápido y menos memoria que `openai/whisper`).

El app de VSL Studio lo consume vía `WHISPER_ENDPOINT` y, si querés protegerlo,
`WHISPER_API_KEY`. En modo `TRANSCRIPTION_PROVIDER=auto` el worker propio se usa
**primero**, y OpenRouter/Groq quedan como respaldo.

## API

| Método | Ruta          | Descripción                                              |
| ------ | ------------- | -------------------------------------------------------- |
| GET    | `/health`     | Estado del worker (sin auth). Lo usa el panel de readiness. |
| POST   | `/transcribe` | `form-data: file=<audio>` → `{ "text": "..." }`.         |

## Runbook real: producción en el Mac mini (launchd + ngrok)

> Este es el setup que quedó andando. El **runtime vive en `~/vsl-whisper/`**, NO
> en `~/Desktop/VSL/worker/whisper` — macOS protege `~/Desktop` con TCC y los
> LaunchAgents no pueden leer ahí (`Operation not permitted`). El código fuente
> vive en el repo; el runtime es una copia en el home.

**Estado que dejó configurado:**
- `~/vsl-whisper/` = copia de `app.py` + venv propio (modelo `small`, español).
- LaunchAgent `~/Library/LaunchAgents/com.admedia.vsl-whisper.plist` (plantilla
  versionada en `launchd/`): arranca el worker al bootear, lo **reinicia solo si
  se cae** (`KeepAlive`) y lo envuelve en `caffeinate -s` para que **la Mac no se
  duerma** mientras corre (sin sudo, funciona en AC power).
- Endpoint protegido con `WHISPER_API_KEY` (Bearer). Sin clave → 401.

**Recrear el runtime desde cero:**
```bash
mkdir -p ~/vsl-whisper
cp worker/whisper/app.py worker/whisper/requirements.txt ~/vsl-whisper/
python3 -m venv ~/vsl-whisper/.venv
~/vsl-whisper/.venv/bin/python -m pip install -U pip
~/vsl-whisper/.venv/bin/python -m pip install -r ~/vsl-whisper/requirements.txt
```

**Instalar/gestionar el LaunchAgent del worker:**
```bash
# copiar la plantilla y poner la clave real
cp worker/whisper/launchd/com.admedia.vsl-whisper.plist ~/Library/LaunchAgents/
# editar ~/Library/LaunchAgents/com.admedia.vsl-whisper.plist -> __WHISPER_API_KEY__

UID=$(id -u)
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.admedia.vsl-whisper.plist
launchctl print gui/$UID/com.admedia.vsl-whisper | grep -E "state|pid"   # verificar
curl -s http://127.0.0.1:8000/health                                     # {"status":"ok",...}

# recargar tras cambiar el plist:
launchctl bootout gui/$UID/com.admedia.vsl-whisper
launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.admedia.vsl-whisper.plist
```

**Túnel con subdominio gratis y estable (ngrok):**
```bash
# 1. Crear cuenta free en ngrok.com y copiar el authtoken.
# 2. Reservar el dominio free (Dashboard -> Domains): xxxx.ngrok-free.app
# 3. Instalar ngrok y guardar el token:
ngrok config add-authtoken <TU_AUTHTOKEN>
# 4. Instalar el LaunchAgent del túnel (plantilla en launchd/):
cp worker/whisper/launchd/com.admedia.vsl-tunnel.plist ~/Library/LaunchAgents/
#    editar: __NGROK_BIN__ (which ngrok) y __NGROK_DOMAIN__ (tu dominio reservado)
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.admedia.vsl-tunnel.plist
```
El dominio reservado NO cambia entre reinicios → `WHISPER_ENDPOINT` se setea una
sola vez. Cuando la Mac vuelve, el túnel se reconecta al mismo hostname.

**Configurar el app (Vercel):**
```
WHISPER_ENDPOINT=https://xxxx.ngrok-free.app/transcribe
WHISPER_API_KEY=<la misma clave del plist>
TRANSCRIPTION_PROVIDER=auto      # worker propio primero, OpenRouter/Groq de respaldo
```

> Para que todo arranque tras un reiniciо **sin loguearte**, activá el auto-login
> del Mac mini (System Settings → Users & Groups → Automatically log in). Los
> LaunchAgents cargan al iniciar sesión.

---

## Opción A — Mac mini (recomendada para empezar, costo cero)

```bash
cd worker/whisper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Modelo: base es buen balance; small/medium mejoran calidad en español.
export WHISPER_MODEL_SIZE=small
export WHISPER_LANGUAGE=es          # forzar español neutro (opcional)
export WHISPER_API_KEY=una-clave-larga-secreta

uvicorn app:app --host 127.0.0.1 --port 8000
```

Probalo local:

```bash
curl -s -H "Authorization: Bearer una-clave-larga-secreta" \
  -F file=@/ruta/a/audio.mp3 http://127.0.0.1:8000/transcribe
```

### Exponerlo a producción (Vercel no alcanza `localhost`)

Con un túnel de Cloudflare (gratis, sin abrir puertos):

```bash
brew install cloudflared
cloudflared tunnel --url http://127.0.0.1:8000
# te da una URL https://xxxx.trycloudflare.com
```

Luego en el entorno del app (Vercel):

```
WHISPER_ENDPOINT=https://xxxx.trycloudflare.com/transcribe
WHISPER_API_KEY=una-clave-larga-secreta
TRANSCRIPTION_PROVIDER=auto   # o "selfhosted" para usar solo el worker
```

> Para que quede fijo y sobreviva reinicios, creá un túnel con nombre
> (`cloudflared tunnel create`) y un dominio propio; el `--url` efímero es ideal
> para pruebas.

## Opción B — VPS / servidor Linux (Docker)

```bash
cd worker/whisper
docker build -t vsl-whisper .
docker run -d --restart unless-stopped -p 8000:8000 \
  -e WHISPER_MODEL_SIZE=small \
  -e WHISPER_LANGUAGE=es \
  -e WHISPER_API_KEY=una-clave-larga-secreta \
  --name vsl-whisper vsl-whisper
```

Poné un reverse proxy con TLS (Caddy/Nginx) delante y apuntá
`WHISPER_ENDPOINT=https://tu-dominio/transcribe`.

## Notas

- **Modelos**: `tiny`/`base` son rápidos; `small`/`medium` dan mejor español;
  `large-v3` es el más preciso pero pesado. Se descargan solos la primera vez.
- **GPU**: en un VPS con NVIDIA, seteá `WHISPER_DEVICE=cuda` y
  `WHISPER_COMPUTE_TYPE=float16`.
- **Chunks**: el app ya segmenta el audio en tramos de 3 min y los envía uno por
  uno, así que el worker no necesita manejar archivos enormes.
- **ffmpeg**: la imagen Docker lo incluye; en el Mac mini instalá `brew install ffmpeg`
  si el modelo no puede leer algún formato.
