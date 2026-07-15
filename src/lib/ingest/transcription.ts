import { readFile } from "node:fs/promises";

export const DEFAULT_OPENROUTER_TRANSCRIPTION_MODEL =
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free";
export const DEFAULT_GROQ_TRANSCRIPTION_MODEL = "whisper-large-v3-turbo";
export const DEFAULT_SELFHOSTED_TRANSCRIPTION_MODEL = "faster-whisper/base";

type TranscriptionProvider = "openrouter" | "groq" | "selfhosted";

export type AudioTranscription = {
  text: string;
  model: string;
  provider: TranscriptionProvider;
  chunks: number;
};

type ProviderFailure = Error & { status?: number; provider?: TranscriptionProvider };

function configuredOpenRouterKeys() {
  return (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

export function configuredWhisperEndpoint() {
  return process.env.WHISPER_ENDPOINT?.trim() || "";
}

export function selfHostedTranscriptionModel() {
  return process.env.WHISPER_MODEL?.trim() || DEFAULT_SELFHOSTED_TRANSCRIPTION_MODEL;
}

function providerError(provider: TranscriptionProvider, status: number, message: string) {
  const error = new Error(message) as ProviderFailure;
  error.status = status;
  error.provider = provider;
  return error;
}

function responseErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && typeof (error as { message?: unknown }).message === "string") {
    return String((error as { message: string }).message);
  }
  return "";
}

async function transcribeOpenRouterChunk(file: string, key: string, model: string) {
  const audio = await readFile(file);
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-OpenRouter-Title": "VSL Studio",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 8_000,
      messages: [{
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcribí fielmente este audio en su idioma original. Devolvé solamente el transcript, sin análisis, traducción, resumen, timestamps ni Markdown. Conservá nombres, cifras, ofertas y llamados a la acción.",
          },
          {
            type: "input_audio",
            input_audio: { data: audio.toString("base64"), format: "mp3" },
          },
        ],
      }],
    }),
    signal: AbortSignal.timeout(90_000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) {
    throw providerError("openrouter", response.status, responseErrorMessage(payload) || `OpenRouter respondió HTTP ${response.status}.`);
  }
  const text = payload.choices?.[0]?.message?.content?.trim();
  if (!text) throw providerError("openrouter", 502, "OpenRouter no devolvió un transcript utilizable.");
  return text;
}

async function transcribeWithOpenRouter(files: string[]): Promise<AudioTranscription> {
  const keys = configuredOpenRouterKeys();
  if (!keys.length) throw providerError("openrouter", 503, "OpenRouter no está configurado para transcribir audio.");
  const model = process.env.OPENROUTER_TRANSCRIPTION_MODEL || DEFAULT_OPENROUTER_TRANSCRIPTION_MODEL;
  const parts: string[] = [];

  for (const file of files) {
    let lastError: ProviderFailure | null = null;
    for (const key of keys) {
      try {
        parts.push(await transcribeOpenRouterChunk(file, key, model));
        lastError = null;
        break;
      } catch (error) {
        lastError = error as ProviderFailure;
        if (![401, 402, 403, 429].includes(lastError.status || 0)) break;
      }
    }
    if (lastError) throw lastError;
  }

  return { text: parts.join("\n\n").trim(), model, provider: "openrouter", chunks: files.length };
}

async function transcribeSelfHostedChunk(file: string, endpoint: string, key: string) {
  const audio = await readFile(file);
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/mpeg" }), "audio.mp3");
  const headers: Record<string, string> = { "ngrok-skip-browser-warning": "true" };
  if (key) headers.Authorization = `Bearer ${key}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: form,
    // El worker corre en CPU/Metal propio: damos margen amplio por chunk de audio.
    signal: AbortSignal.timeout(300_000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { text?: string };
  if (!response.ok) {
    throw providerError("selfhosted", response.status, responseErrorMessage(payload) || `El worker Whisper respondió HTTP ${response.status}.`);
  }
  const text = payload.text?.trim();
  if (!text) throw providerError("selfhosted", 502, "El worker Whisper no devolvió un transcript utilizable.");
  return text;
}

async function transcribeWithSelfHosted(files: string[]): Promise<AudioTranscription> {
  const endpoint = configuredWhisperEndpoint();
  if (!endpoint) throw providerError("selfhosted", 503, "El worker Whisper self-hosted no está configurado (falta WHISPER_ENDPOINT).");
  const key = process.env.WHISPER_API_KEY?.trim() || "";
  const model = selfHostedTranscriptionModel();
  const parts: string[] = [];
  for (const file of files) parts.push(await transcribeSelfHostedChunk(file, endpoint, key));
  return { text: parts.join("\n\n").trim(), model, provider: "selfhosted", chunks: files.length };
}

async function transcribeGroqChunk(file: string, key: string, model: string) {
  const audio = await readFile(file);
  const form = new FormData();
  form.append("file", new Blob([audio], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", model);
  form.append("response_format", "json");
  form.append("prompt", "Transcripción fiel en el idioma original. Conservá nombres, cifras, ofertas y llamados a la acción.");
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
    signal: AbortSignal.timeout(90_000),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { text?: string };
  if (!response.ok) {
    throw providerError("groq", response.status, responseErrorMessage(payload) || `Groq respondió HTTP ${response.status}.`);
  }
  const text = payload.text?.trim();
  if (!text) throw providerError("groq", 502, "Groq no devolvió un transcript utilizable.");
  return text;
}

async function transcribeWithGroq(files: string[]): Promise<AudioTranscription> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw providerError("groq", 503, "Groq no está configurado para transcribir audio.");
  const model = process.env.GROQ_TRANSCRIPTION_MODEL || DEFAULT_GROQ_TRANSCRIPTION_MODEL;
  const parts: string[] = [];
  for (const file of files) parts.push(await transcribeGroqChunk(file, key, model));
  return { text: parts.join("\n\n").trim(), model, provider: "groq", chunks: files.length };
}

export async function transcribeAudioChunks(files: string[]): Promise<AudioTranscription> {
  const preference = (process.env.TRANSCRIPTION_PROVIDER || "auto").toLowerCase();
  const hasSelfHosted = configuredWhisperEndpoint().length > 0;
  const hasOpenRouter = configuredOpenRouterKeys().length > 0;
  const hasGroq = Boolean(process.env.GROQ_API_KEY?.trim());
  if (preference === "selfhosted" || preference === "whisper") return validateTranscript(await transcribeWithSelfHosted(files));
  if (preference === "groq") return validateTranscript(await transcribeWithGroq(files));
  if (preference === "openrouter") return validateTranscript(await transcribeWithOpenRouter(files));

  // auto: Whisper propio primero (gratis, sin saldo), luego los proveedores en la nube.
  if (hasSelfHosted) {
    try {
      return validateTranscript(await transcribeWithSelfHosted(files));
    } catch (error) {
      if (!hasOpenRouter && !hasGroq) throw error;
    }
  }
  if (hasOpenRouter) {
    try {
      return validateTranscript(await transcribeWithOpenRouter(files));
    } catch (error) {
      if (!hasGroq) throw error;
    }
  }
  if (hasGroq) return validateTranscript(await transcribeWithGroq(files));
  throw new Error("No hay transcripción de audio configurada. Levantá el worker Whisper (WHISPER_ENDPOINT), agregá saldo a OpenRouter o configurá GROQ_API_KEY.");
}

function validateTranscript(result: AudioTranscription) {
  if (result.text.length < 100) throw new Error("La transcripción resultó demasiado corta para analizarla.");
  return result;
}

export function transcriptionErrorMessage(error: unknown) {
  const failure = error as ProviderFailure;
  const message = error instanceof Error ? error.message : String(error);
  if (failure.provider === "selfhosted" || (configuredWhisperEndpoint() && /fetch failed|ECONNREFUSED|ENOTFOUND|timed out|aborted/i.test(message))) {
    return "El worker Whisper self-hosted no respondió. Verificá que esté corriendo y accesible en WHISPER_ENDPOINT, o configurá un proveedor de respaldo.";
  }
  if (failure.provider === "openrouter" && failure.status === 402) {
    return "OpenRouter exige al menos USD 0,50 de saldo en la cuenta para habilitar audio, aunque el modelo elegido sea gratuito. Cargá ese saldo una sola vez o configurá GROQ_API_KEY y reintentá.";
  }
  if (/incorrect api key|invalid api key|authentication|unauthorized|\b401\b/i.test(message)) {
    return `${failure.provider === "groq" ? "GROQ_API_KEY" : "Una clave de OpenRouter"} fue rechazada. Revisá la configuración y reintentá.`;
  }
  return message.replace(/sk-[A-Za-z0-9_-]{8,}/g, "[clave oculta]");
}
