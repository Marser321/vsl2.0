# Worker Whisper self-hosted para VSL Studio (para VPS/servidor Linux).
# En el Mac mini conviene correrlo con un venv nativo (ver README) para usar Metal/CPU sin Docker.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py .

ENV WHISPER_MODEL_SIZE=base \
    WHISPER_DEVICE=auto \
    PORT=8000

EXPOSE 8000
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
