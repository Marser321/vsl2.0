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
 * Usa el proveedor por defecto (Configuración): Claude u OpenAI.
 * Usada por las features de análisis: hooks, crítica, autopilot, aprendizajes.
 */
export async function generateJSON<T>(args: Args): Promise<T> {
  const provider = await getSetting("default_provider", "anthropic");
  if (provider === "openrouter") {
    const { generateOpenRouterJSON } = await import("./openrouter");
    return generateOpenRouterJSON<T>(args);
  }
  if (provider === "openai") {
    if (process.env.OPENAI_API_KEY) return generateJSONOpenAI<T>(args);
    if (process.env.ANTHROPIC_API_KEY) return generateJSONAnthropic<T>(args);
    throw new Error("Falta OPENAI_API_KEY (u ANTHROPIC_API_KEY) en .env.local.");
  }
  if (process.env.ANTHROPIC_API_KEY) return generateJSONAnthropic<T>(args);
  if (process.env.OPENAI_API_KEY) return generateJSONOpenAI<T>(args);
  throw new Error("Falta ANTHROPIC_API_KEY (u OPENAI_API_KEY) en .env.local.");
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

async function generateJSONOpenAI<T>(args: Args): Promise<T> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI();
  const model = await getSetting("default_model_openai", "gpt-5.2");

  const system = args.systemBlocks.map((b) => b.text).join("\n\n---\n\n");

  const res = await client.chat.completions.create({
    model,
    max_completion_tokens: args.maxTokens ?? 8192,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "resultado",
        strict: true,
        schema: args.schema,
      },
    },
    messages: [
      { role: "system", content: system },
      { role: "user", content: args.userMessage },
    ],
  });

  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error("La respuesta del modelo llegó vacía.");
  return JSON.parse(text) as T;
}
