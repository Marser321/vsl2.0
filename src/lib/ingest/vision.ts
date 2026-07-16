import OpenAI from "openai";

const PROMPT = "Extraé todo el texto visible y describí únicamente la información útil para redactar un VSL: producto, marca, beneficios, oferta, prueba, testimonios y claims. No inventes nada. Respondé en español con secciones claras.";

export async function analyzeBinaryAsset(buffer: Buffer, mimeType: string, _filename: string) {
  const base64 = buffer.toString("base64");
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
  throw new Error(
    mimeType === "application/pdf"
      ? "El análisis de PDF escaneado no está disponible por ahora — extraé el texto o subí capturas de pantalla como imagen."
      : "Se necesita una clave de OpenRouter para analizar esta imagen."
  );
}
