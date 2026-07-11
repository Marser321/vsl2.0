import OpenAI from "openai";
import type { UsageInfo } from "@/db/schema";
import { getSetting, setSetting } from "@/lib/settings";
import type { GenerateRequest } from "./provider";
import { apiKeyEngine } from "./key-rotator";

const DAILY_LIMIT = 50;
const ENSEMBLE_SIZE = 5;
const CALLS_PER_RUN = ENSEMBLE_SIZE + 1;
const MODEL_CACHE_MS = 10 * 60 * 1000;

const ROLES = [
  "Arquitecto senior de respuesta directa: priorizá estructura persuasiva, mecanismo y progresión emocional.",
  "Especialista en audiencia y voz: priorizá empatía, lenguaje natural en español y resonancia emocional.",
  "Especialista en oferta: fortalecé promesa, prueba, objeciones, urgencia legítima y CTA.",
  "Auditor de evidencia: detectá contradicciones, claims inventados, huecos lógicos y riesgos de credibilidad.",
  "Editor jefe implacable: mejorá claridad, ritmo oral, especificidad, concisión y formato final.",
] as const;

type ModelRecord = {
  id: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  architecture?: { output_modalities?: string[] };
};

type RunUsage = UsageInfo & { models: string[]; degraded: boolean };

let modelCache: { at: number; models: ModelRecord[] } | null = null;

function client(forceKey?: string): OpenAI {
  const apiKey = forceKey || apiKeyEngine.getKey();
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    maxRetries: 0,
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "http://localhost:3000",
      "X-OpenRouter-Title": "VSL App",
    },
  });
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function getOpenRouterQuota() {
  const today = todayUtc();
  const storedDay = await getSetting("openrouter_quota_day");
  const limit = DAILY_LIMIT * apiKeyEngine.keyCount;
  const used = storedDay === today
    ? Number.parseInt(await getSetting("openrouter_quota_used", "0"), 10) || 0
    : 0;
  return { day: today, used, remaining: Math.max(0, limit - used), limit };
}

async function reserveEnsembleCalls(): Promise<void> {
  const quota = await getOpenRouterQuota();
  if (quota.remaining < CALLS_PER_RUN) {
    throw new Error(
      `Cuota diaria insuficiente: quedan ${quota.remaining} llamadas y el arnés 5+1 necesita ${CALLS_PER_RUN}.`
    );
  }
  await setSetting("openrouter_quota_day", quota.day);
  await setSetting("openrouter_quota_used", String(quota.used + CALLS_PER_RUN));
}

async function freeModels(needsStructuredOutput: boolean): Promise<string[]> {
  if (!modelCache || Date.now() - modelCache.at > MODEL_CACHE_MS) {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      headers: { Authorization: `Bearer ${apiKeyEngine.getKey()}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`No se pudo consultar modelos de OpenRouter (${res.status}).`);
    const json = (await res.json()) as { data?: ModelRecord[] };
    modelCache = { at: Date.now(), models: json.data ?? [] };
  }

  const compatible = modelCache.models
    .filter((m) => {
      const isFree = m.id.endsWith(":free") ||
        (Number(m.pricing?.prompt ?? 1) === 0 && Number(m.pricing?.completion ?? 1) === 0);
      const structured = !needsStructuredOutput ||
        m.supported_parameters?.some((p) => p === "structured_outputs" || p === "response_format");
      const producesText = !m.architecture?.output_modalities || m.architecture.output_modalities.includes("text");
      // 60k: el bloque global (corpus + frameworks) + dossier por cliente ya no entra cómodo en 32k.
      return isFree && structured && producesText && (m.context_length ?? 0) >= 60_000;
    })
    .sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0));

  const ids = compatible.map((m) => m.id).slice(0, CALLS_PER_RUN);
  while (ids.length < CALLS_PER_RUN) ids.push("openrouter/free");
  return ids;
}

function addUsage(total: UsageInfo, usage?: { prompt_tokens: number; completion_tokens: number } | null) {
  if (!usage) return;
  total.inputTokens += usage.prompt_tokens;
  total.outputTokens += usage.completion_tokens;
}

function systemText(req: GenerateRequest, role?: string): string {
  const base = req.systemBlocks.map((b) => b.text).join("\n\n---\n\n");
  return role ? `${base}\n\n# Rol dentro del panel\n${role}` : base;
}

function messages(req: GenerateRequest, role?: string) {
  return [
    { role: "system" as const, content: systemText(req, role) },
    ...req.messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

async function executeWithRetry<T>(fn: (api: OpenAI) => Promise<T>): Promise<T> {
  const maxAttempts = apiKeyEngine.keyCount;
  let attempt = 0;
  let lastError: any;

  while (attempt < maxAttempts) {
    const currentKey = apiKeyEngine.getKey();
    const api = client(currentKey);
    try {
      return await fn(api);
    } catch (error: any) {
      lastError = error;
      const status = error?.status || error?.response?.status;
      // 429: Too Many Requests, 401: Unauthorized, 403: Forbidden
      if (status === 429 || status === 401 || status === 403) {
        apiKeyEngine.markExhausted(currentKey);
        attempt++;
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export class OpenRouterEnsembleProvider {
  private usage: RunUsage | null = null;

  async *generateStream(req: GenerateRequest): AsyncIterable<string> {
    await reserveEnsembleCalls();
    req.onStatus?.({ stage: "Seleccionando modelos gratuitos", completed: 0, total: CALLS_PER_RUN });
    const models = await freeModels(false);
    const total: UsageInfo = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };

    let completed = 0;
    req.onStatus?.({ stage: "Consultando especialistas", completed, total: CALLS_PER_RUN });
    const attempts = await Promise.allSettled(
      ROLES.map(async (role, index) => {
        try {
          const result = await executeWithRetry((api) => api.chat.completions.create({
            model: models[index],
            messages: messages(req, role),
            max_tokens: Math.min(req.maxTokens, 20_000),
          }));
          addUsage(total, result.usage);
          const text = result.choices[0]?.message?.content;
          if (!text) throw new Error(`El especialista ${index + 1} respondió vacío.`);
          return { text, model: result.model ?? models[index] };
        } finally {
          completed += 1;
          req.onStatus?.({ stage: "Consultando especialistas", completed, total: CALLS_PER_RUN });
        }
      })
    );
    const candidates = attempts.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
    if (candidates.length === 0) throw new Error("Ningún modelo gratuito pudo completar la tarea.");

    if (candidates.length === 1) {
      req.onStatus?.({ stage: "Resultado degradado", completed: CALLS_PER_RUN, total: CALLS_PER_RUN, degraded: true });
      this.usage = { ...total, models: [candidates[0].model], degraded: true };
      yield candidates[0].text;
      return;
    }

    const synthesisPrompt = candidates
      .map((c, i) => `## Propuesta ${i + 1} (${c.model})\n${c.text}`)
      .join("\n\n---\n\n");
    req.onStatus?.({ stage: "Sintetizando resultado final", completed: 5, total: CALLS_PER_RUN, degraded: candidates.length < ENSEMBLE_SIZE });
    const stream = await executeWithRetry((api) => api.chat.completions.create({
      model: models[5],
      stream: true,
      stream_options: { include_usage: true },
      max_tokens: Math.min(req.maxTokens, 32_000),
      messages: [
        {
          role: "system",
          content: `${systemText(req)}\n\nSos el copy chief que sintetiza un panel. Combiná lo mejor, corregí contradicciones y devolvé solamente la salida final solicitada, sin mencionar al panel ni el proceso.`,
        },
        { role: "user", content: `Sintetizá estas propuestas:\n\n${synthesisPrompt}` },
      ],
    }));
    let finalModel = models[5];
    for await (const chunk of stream) {
      finalModel = chunk.model ?? finalModel;
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
      addUsage(total, chunk.usage);
    }
    this.usage = {
      ...total,
      models: [...candidates.map((c) => c.model), finalModel],
      degraded: candidates.length < ENSEMBLE_SIZE,
    };
    req.onStatus?.({ stage: "Completado", completed: CALLS_PER_RUN, total: CALLS_PER_RUN, degraded: candidates.length < ENSEMBLE_SIZE });
  }

  getFinalUsage(): RunUsage | null {
    return this.usage;
  }
}

export async function generateOpenRouterJSON<T>(args: {
  systemBlocks: { text: string }[];
  userMessage: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  await reserveEnsembleCalls();
  const models = await freeModels(true);
  const baseSystem = args.systemBlocks.map((b) => b.text).join("\n\n---\n\n");
  const responseFormat = {
    type: "json_schema" as const,
    json_schema: { name: "resultado", strict: true, schema: args.schema },
  };
  const attempts = await Promise.allSettled(
    ROLES.map(async (role, index) => {
      const result = await executeWithRetry((api) => api.chat.completions.create({
        model: models[index],
        max_tokens: args.maxTokens ?? 8192,
        response_format: responseFormat,
        messages: [
          { role: "system", content: `${baseSystem}\n\n# Rol dentro del panel\n${role}` },
          { role: "user", content: args.userMessage },
        ],
      }));
      const text = result.choices[0]?.message?.content;
      if (!text) throw new Error("Respuesta estructurada vacía.");
      JSON.parse(text);
      return text;
    })
  );
  const candidates = attempts.flatMap((r) => r.status === "fulfilled" ? [r.value] : []);
  if (candidates.length === 0) throw new Error("Ningún modelo produjo JSON válido.");
  if (candidates.length === 1) return JSON.parse(candidates[0]) as T;

  const result = await executeWithRetry((api) => api.chat.completions.create({
    model: models[5],
    max_tokens: args.maxTokens ?? 8192,
    response_format: responseFormat,
    messages: [
      {
        role: "system",
        content: `${baseSystem}\n\nSos el evaluador final. Sintetizá las propuestas y devolvé únicamente JSON válido que respete exactamente el esquema solicitado.`,
      },
      {
        role: "user",
        content: `${args.userMessage}\n\n# Propuestas del panel\n${candidates.map((c, i) => `Propuesta ${i + 1}: ${c}`).join("\n\n")}`,
      },
    ],
  }));
  const text = result.choices[0]?.message?.content;
  if (!text) throw new Error("El sintetizador devolvió una respuesta vacía.");
  return JSON.parse(text) as T;
}
