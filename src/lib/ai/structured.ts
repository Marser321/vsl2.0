import { getSetting } from "@/lib/settings";
import type { SystemBlock } from "./provider";

type Args = {
  systemBlocks: SystemBlock[];
  userMessage: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
};

/**
 * Llamada única con salida estructurada (JSON Schema).
 * Prioriza OpenRouter y conserva Anthropic como alternativa explícita.
 * Usada por las features de análisis: hooks, crítica, autopilot, aprendizajes.
 */
export async function generateJSON<T>(args: Args): Promise<T> {
  const provider = await getSetting("default_provider", "openrouter");
  if (provider !== "anthropic") {
    const keys = process.env.OPENROUTER_API_KEYS ?? process.env.OPENROUTER_API_KEY;
    if (!keys) {
      if (process.env.ANTHROPIC_API_KEY) return generateJSONAnthropic<T>(args);
      throw new Error("Falta OPENROUTER_API_KEYS (o ANTHROPIC_API_KEY) en .env.local.");
    }
    const { generateOpenRouterJSON } = await import("./openrouter");
    return generateOpenRouterJSON<T>(args);
  }
  if (process.env.ANTHROPIC_API_KEY) return generateJSONAnthropic<T>(args);
  const keys = process.env.OPENROUTER_API_KEYS ?? process.env.OPENROUTER_API_KEY;
  if (keys) {
    const { generateOpenRouterJSON } = await import("./openrouter");
    return generateOpenRouterJSON<T>(args);
  }
  throw new Error("Falta ANTHROPIC_API_KEY (u OPENROUTER_API_KEYS) en .env.local.");
}

async function generateJSONAnthropic<T>(args: Args): Promise<T> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const model = await getSetting("default_model_anthropic", "claude-opus-4-8");

  const system = args.systemBlocks.map((b) => ({
    type: "text" as const,
    text: b.text,
    ...(b.cache
      ? { cache_control: { type: "ephemeral" as const, ttl: "1h" as const } }
      : {}),
  }));

  const stream = client.messages.stream({
    model,
    max_tokens: args.maxTokens ?? 8192,
    thinking: { type: "adaptive" },
    output_config: {
      effort: "high",
      format: { type: "json_schema", schema: args.schema },
    },
    system,
    messages: [{ role: "user", content: args.userMessage }],
  });

  const final = await stream.finalMessage();
  const text = final.content.find((b) => b.type === "text")?.text;
  if (!text) throw new Error("La respuesta del modelo llegó vacía.");
  return JSON.parse(text) as T;
}
