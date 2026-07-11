import OpenAI from "openai";
import type { UsageInfo } from "@/db/schema";
import type { CopyProvider, GenerateRequest } from "./provider";

export class OpenAIProvider implements CopyProvider {
  private client: OpenAI;
  private usage: UsageInfo | null = null;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        "Falta OPENAI_API_KEY en .env.local — configurala y reiniciá el servidor."
      );
    }
    this.client = new OpenAI();
  }

  async *generateStream(req: GenerateRequest): AsyncIterable<string> {
    // OpenAI cachea prefijos automáticamente; concatenamos los bloques system.
    const system = req.systemBlocks.map((b) => b.text).join("\n\n---\n\n");

    const stream = await this.client.chat.completions.create({
      model: req.model,
      stream: true,
      stream_options: { include_usage: true },
      max_completion_tokens: req.maxTokens,
      messages: [
        { role: "system", content: system },
        ...req.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
      if (chunk.usage) {
        this.usage = {
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          cacheReadTokens:
            chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
          cacheCreationTokens: 0,
        };
      }
    }
  }

  getFinalUsage(): UsageInfo | null {
    return this.usage;
  }
}
