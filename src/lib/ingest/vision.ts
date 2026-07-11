import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { getSetting } from "@/lib/settings";

const PROMPT = "Extraé todo el texto visible y describí únicamente la información útil para redactar un VSL: producto, marca, beneficios, oferta, prueba, testimonios y claims. No inventes nada. Respondé en español con secciones claras.";

export async function analyzeBinaryAsset(buffer: Buffer, mimeType: string, filename: string) {
  const base64 = buffer.toString("base64");
  if (process.env.ANTHROPIC_API_KEY) {
    const model = await getSetting("default_model_anthropic", "claude-opus-4-8");
    const client = new Anthropic();
    const source = { type: "base64", media_type: mimeType, data: base64 };
    const content = mimeType === "application/pdf"
      ? [{ type: "document", source }, { type: "text", text: PROMPT }]
      : [{ type: "image", source }, { type: "text", text: PROMPT }];
    const response = await client.messages.create({ model, max_tokens: 5000, messages: [{ role: "user", content: content as never }] });
    const text = response.content.find((item) => item.type === "text")?.text;
    if (!text) throw new Error("El analizador visual no devolvió texto.");
    return { text, provider: "anthropic", model };
  }
  if (process.env.OPENAI_API_KEY) {
    const model = await getSetting("default_model_openai", "gpt-5.2");
    const client = new OpenAI();
    const content = mimeType === "application/pdf"
      ? [{ type: "input_file", filename, file_data: `data:${mimeType};base64,${base64}` }, { type: "input_text", text: PROMPT }]
      : [{ type: "input_image", image_url: `data:${mimeType};base64,${base64}`, detail: "high" }, { type: "input_text", text: PROMPT }];
    const response = await client.responses.create({ model, input: [{ role: "user", content }] } as never);
    if (!response.output_text) throw new Error("El analizador visual no devolvió texto.");
    return { text: response.output_text, provider: "openai", model };
  }
  const keys = process.env.OPENROUTER_API_KEYS ?? process.env.OPENROUTER_API_KEY;
  if (keys && mimeType.startsWith("image/")) {
    const model = "openrouter/free";
    const client = new OpenAI({ apiKey: keys.split(",")[0].trim(), baseURL: "https://openrouter.ai/api/v1" });
    const response = await client.chat.completions.create({
      model,
      max_tokens: 5000,
      messages: [{ role: "user", content: [{ type: "text", text: PROMPT }, { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }] }],
    });
    const text = response.choices[0]?.message.content;
    if (!text) throw new Error("El analizador visual no devolvió texto.");
    return { text, provider: "openrouter", model };
  }
  throw new Error("Se necesita Anthropic u OpenAI para analizar esta imagen o PDF escaneado.");
}
