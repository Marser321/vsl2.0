import {
  DEFAULT_GROQ_TRANSCRIPTION_MODEL,
  DEFAULT_OPENROUTER_TRANSCRIPTION_MODEL,
  configuredWhisperEndpoint,
  selfHostedTranscriptionModel,
} from "@/lib/ingest/transcription";

export type TranscriptionReadiness = {
  configured: boolean;
  available: boolean;
  validated: boolean;
  provider: "openrouter" | "groq" | "selfhosted" | "none";
  model: string;
  error: string | null;
};

const CACHE_MS = 5 * 60 * 1000;
let cached: { expiresAt: number; key: string; value: TranscriptionReadiness } | null = null;

function firstOpenRouterKey() {
  return (process.env.OPENROUTER_API_KEYS || process.env.OPENROUTER_API_KEY || "")
    .split(",")
    .map((key) => key.trim())
    .find(Boolean) || "";
}

export async function transcriptionReadiness(): Promise<TranscriptionReadiness> {
  const preference = (process.env.TRANSCRIPTION_PROVIDER || "auto").toLowerCase();
  const whisperEndpoint = configuredWhisperEndpoint();
  const whisperModel = selfHostedTranscriptionModel();
  const preferSelfHosted = preference === "selfhosted" || preference === "whisper";

  if (whisperEndpoint && (preferSelfHosted || preference === "auto")) {
    const health = await checkWhisperWorker(whisperEndpoint);
    return {
      configured: true,
      available: health.reachable,
      validated: health.checked,
      provider: "selfhosted",
      model: whisperModel,
      error: health.reachable ? null : "El worker Whisper self-hosted no respondió. Verificá que esté corriendo y accesible en WHISPER_ENDPOINT.",
    };
  }
  if (preferSelfHosted) {
    return { configured: false, available: false, validated: true, provider: "selfhosted", model: whisperModel, error: "Falta WHISPER_ENDPOINT para usar el worker Whisper self-hosted." };
  }

  const groqKey = process.env.GROQ_API_KEY?.trim() || "";
  const allowGroqFallback = preference === "auto";
  const openRouterKey = firstOpenRouterKey();
  const openRouterModel = process.env.OPENROUTER_TRANSCRIPTION_MODEL || DEFAULT_OPENROUTER_TRANSCRIPTION_MODEL;
  const groqModel = process.env.GROQ_TRANSCRIPTION_MODEL || DEFAULT_GROQ_TRANSCRIPTION_MODEL;

  if (preference === "groq" || (!openRouterKey && groqKey)) {
    return groqKey
      ? { configured: true, available: true, validated: false, provider: "groq", model: groqModel, error: null }
      : { configured: false, available: false, validated: true, provider: "groq", model: groqModel, error: "Falta GROQ_API_KEY para transcribir audio." };
  }
  if (!openRouterKey) {
    return { configured: false, available: false, validated: true, provider: "none", model: openRouterModel, error: "Falta una clave de OpenRouter o GROQ_API_KEY para transcribir audio." };
  }

  const cacheKey = `${openRouterKey.slice(-8)}:${openRouterModel}:${Boolean(groqKey)}`;
  if (cached && cached.expiresAt > Date.now() && cached.key === cacheKey) return cached.value;
  let value: TranscriptionReadiness;
  try {
    const response = await fetch("https://openrouter.ai/api/v1/credits", {
      headers: { Authorization: `Bearer ${openRouterKey}` },
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({})) as { data?: { total_credits?: number; total_usage?: number } };
    const balance = Number(payload.data?.total_credits || 0) - Number(payload.data?.total_usage || 0);
    if (response.ok && balance + Number.EPSILON >= 0.5) {
      value = { configured: true, available: true, validated: true, provider: "openrouter", model: openRouterModel, error: null };
    } else if (response.ok && groqKey && allowGroqFallback) {
      value = { configured: true, available: true, validated: false, provider: "groq", model: groqModel, error: "OpenRouter no tiene el saldo mínimo para audio; se usará Groq automáticamente." };
    } else if (response.ok) {
      value = {
        configured: true,
        available: false,
        validated: true,
        provider: "openrouter",
        model: openRouterModel,
        error: "OpenRouter exige al menos USD 0,50 de saldo para habilitar audio, aunque este modelo sea gratuito. Los subtítulos públicos siguen funcionando.",
      };
    } else if (response.status === 401 || response.status === 403) {
      value = { configured: true, available: false, validated: true, provider: "openrouter", model: openRouterModel, error: "La clave de OpenRouter fue rechazada." };
    } else {
      value = { configured: true, available: false, validated: false, provider: "openrouter", model: openRouterModel, error: `OpenRouter no pudo validarse (HTTP ${response.status}).` };
    }
  } catch {
    value = { configured: true, available: false, validated: false, provider: "openrouter", model: openRouterModel, error: "No se pudo contactar a OpenRouter para validar la transcripción." };
  }
  cached = { expiresAt: Date.now() + CACHE_MS, key: cacheKey, value };
  return value;
}

export function resetTranscriptionReadinessCache() {
  cached = null;
}

// El worker expone /health junto al endpoint de transcripción; probamos ese
// vecino sin bloquear si no existe.
function whisperHealthUrl(endpoint: string) {
  try {
    const url = new URL(endpoint);
    url.pathname = url.pathname.replace(/\/transcribe\/?$/, "/health");
    if (url.pathname === new URL(endpoint).pathname) url.pathname = url.pathname.replace(/\/?$/, "/health");
    return url.toString();
  } catch {
    return null;
  }
}

async function checkWhisperWorker(endpoint: string): Promise<{ reachable: boolean; checked: boolean }> {
  const healthUrl = whisperHealthUrl(endpoint);
  if (!healthUrl) return { reachable: true, checked: false };
  try {
    const response = await fetch(healthUrl, {
      headers: { "ngrok-skip-browser-warning": "true" },
      signal: AbortSignal.timeout(3_000),
      cache: "no-store",
    });
    return { reachable: response.ok, checked: true };
  } catch {
    return { reachable: false, checked: true };
  }
}
