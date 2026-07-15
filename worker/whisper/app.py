"""Worker de transcripción self-hosted para VSL Studio.

Expone una API HTTP mínima sobre faster-whisper (CTranslate2). El app de Next
la orquesta vía WHISPER_ENDPOINT y opcionalmente WHISPER_API_KEY.

Endpoints:
  GET  /health      -> {"status": "ok", "model": "..."}  (sin auth)
  POST /transcribe  -> {"text": "...", "model": "...", "language": "es"}
                       form-data: file=<audio/video>

Variables de entorno:
  WHISPER_MODEL_SIZE   tiny | base | small | medium | large-v3   (default: base)
  WHISPER_DEVICE       cpu | cuda | auto                          (default: auto)
  WHISPER_COMPUTE_TYPE int8 | int8_float16 | float16 | float32    (default: auto)
  WHISPER_LANGUAGE     código ISO forzado, ej. "es"; vacío = autodetección
  WHISPER_API_KEY      si se define, exige Authorization: Bearer <clave>
"""

import os
import tempfile
from typing import Optional

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from faster_whisper import WhisperModel

MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "base")
DEVICE = os.environ.get("WHISPER_DEVICE", "auto")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "") or ("int8" if DEVICE in ("cpu", "auto") else "float16")
LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "").strip() or None
API_KEY = os.environ.get("WHISPER_API_KEY", "").strip()
MAX_BYTES = int(os.environ.get("WHISPER_MAX_BYTES", str(120 * 1024 * 1024)))

app = FastAPI(title="VSL Studio · Whisper worker")

# La carga del modelo es perezosa para que /health responda aunque el modelo
# todavía se esté descargando la primera vez.
_model: Optional[WhisperModel] = None


def get_model() -> WhisperModel:
    global _model
    if _model is None:
        _model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    return _model


def require_auth(authorization: Optional[str] = Header(default=None)) -> None:
    if not API_KEY:
        return
    expected = f"Bearer {API_KEY}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Clave del worker Whisper inválida.")


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "model": f"faster-whisper/{MODEL_SIZE}", "loaded": _model is not None}


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...), _: None = Depends(require_auth)) -> dict:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Archivo de audio vacío.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="El archivo supera el límite del worker.")

    suffix = os.path.splitext(file.filename or "audio.mp3")[1] or ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=True) as tmp:
        tmp.write(data)
        tmp.flush()
        segments, info = get_model().transcribe(
            tmp.name,
            language=LANGUAGE,
            vad_filter=True,
            beam_size=5,
        )
        text = " ".join(segment.text.strip() for segment in segments).strip()

    if not text:
        raise HTTPException(status_code=422, detail="No se detectó voz en el audio.")
    return {"text": text, "model": f"faster-whisper/{MODEL_SIZE}", "language": info.language}
