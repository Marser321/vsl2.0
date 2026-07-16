import type { SystemBlock } from "./provider";

type Args = {
  systemBlocks: SystemBlock[];
  userMessage: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
};

/**
 * Llamada única con salida estructurada (JSON Schema) usando el arnés de
 * OpenRouter con rotación de claves.
 * Usada por las features de análisis: hooks, crítica, autopilot, aprendizajes.
 */
export async function generateJSON<T>(args: Args): Promise<T> {
  const hasOpenRouter = Boolean(process.env.OPENROUTER_API_KEYS ?? process.env.OPENROUTER_API_KEY);
  if (!hasOpenRouter) {
    throw new Error("Falta OPENROUTER_API_KEYS en .env.local.");
  }

  const { generateOpenRouterJSON } = await import("./openrouter");
  return generateOpenRouterJSON<T>(args);
}
