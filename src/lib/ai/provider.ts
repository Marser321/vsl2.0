import type { UsageInfo } from "@/db/schema";

export type SystemBlock = {
  text: string;
  /** Marca este bloque como breakpoint de caché cuando el proveedor lo soporta. */
  cache?: boolean;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateRequest = {
  model: string;
  systemBlocks: SystemBlock[];
  messages: ChatMessage[];
  maxTokens: number;
  onStatus?: (status: { stage: string; completed: number; total: number; degraded?: boolean }) => void;
};

export interface CopyProvider {
  /** Emite deltas de texto. Al agotarse el iterable, getFinalUsage() queda disponible. */
  generateStream(req: GenerateRequest): AsyncIterable<string>;
  getFinalUsage(): UsageInfo | null;
}

export type ProviderName = "anthropic" | "openai" | "openrouter";
export type OperationalProviderName = Exclude<ProviderName, "openai">;

export async function getProvider(name: ProviderName): Promise<CopyProvider> {
  if (name === "openrouter") {
    const { OpenRouterEnsembleProvider } = await import("./openrouter");
    return new OpenRouterEnsembleProvider();
  }
  if (name === "anthropic") {
    const { AnthropicProvider } = await import("./anthropic");
    return new AnthropicProvider();
  }
  throw new Error("OpenAI está deshabilitado. Usá OpenRouter o Anthropic.");
}
