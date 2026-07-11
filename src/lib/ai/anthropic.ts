import Anthropic from "@anthropic-ai/sdk";
import type { UsageInfo } from "@/db/schema";
import type { CopyProvider, GenerateRequest } from "./provider";

export class AnthropicProvider implements CopyProvider {
  private client: Anthropic;
  private usage: UsageInfo | null = null;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "Falta ANTHROPIC_API_KEY en .env.local — configurala y reiniciá el servidor."
      );
    }
    this.client = new Anthropic();
  }

  async *generateStream(req: GenerateRequest): AsyncIterable<string> {
    const system: Anthropic.TextBlockParam[] = req.systemBlocks.map((b) => ({
      type: "text",
      text: b.text,
      ...(b.cache
        ? { cache_control: { type: "ephemeral" as const, ttl: "1h" as const } }
        : {}),
    }));

    const stream = this.client.messages.stream({
      model: req.model,
      max_tokens: req.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: "high" },
      system,
      messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }

    const final = await stream.finalMessage();
    this.usage = {
      inputTokens: final.usage.input_tokens,
      outputTokens: final.usage.output_tokens,
      cacheReadTokens: final.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: final.usage.cache_creation_input_tokens ?? 0,
    };
  }

  getFinalUsage(): UsageInfo | null {
    return this.usage;
  }
}

/** Cuenta tokens de un texto contra el modelo por defecto (para documents.tokenCount). */
export async function countTokens(text: string, model: string): Promise<number> {
  if (!process.env.ANTHROPIC_API_KEY) return Math.ceil(text.length / 4);
  try {
    const client = new Anthropic();
    const res = await client.messages.countTokens({
      model,
      messages: [{ role: "user", content: text }],
    });
    return res.input_tokens;
  } catch {
    // estimación burda si la API no está disponible
    return Math.ceil(text.length / 4);
  }
}
