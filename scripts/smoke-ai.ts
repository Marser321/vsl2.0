/**
 * Smoke test de proveedores de IA.
 * Uso: npm run smoke:ai  (requiere claves en .env.local)
 */
import fs from "node:fs";
import path from "node:path";

// Cargar .env.local a mano (tsx no lo hace solo)
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function testAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("⚠ ANTHROPIC_API_KEY no configurada — salteando Claude");
    return;
  }
  const { AnthropicProvider } = await import("../src/lib/ai/anthropic");
  const provider = new AnthropicProvider();
  let text = "";
  let deltas = 0;
  for await (const delta of provider.generateStream({
    model: "claude-opus-4-8",
    systemBlocks: [
      { text: "Sos un copywriter. Respondé en una sola frase corta.", cache: false },
    ],
    messages: [{ role: "user", content: "Escribí un gancho de VSL para un curso de cocina." }],
    maxTokens: 1024,
  })) {
    text += delta;
    deltas++;
  }
  const usage = provider.getFinalUsage();
  if (deltas === 0) throw new Error("Claude: el stream no emitió deltas");
  if (!usage) throw new Error("Claude: usage no disponible");
  console.log(`✓ Claude OK — ${deltas} deltas, ${usage.outputTokens} tokens de salida`);
  console.log(`  "${text.slice(0, 100)}"`);
}

async function testOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    console.log("⚠ OPENAI_API_KEY no configurada — salteando OpenAI");
    return;
  }
  const { OpenAIProvider } = await import("../src/lib/ai/openai");
  const { getSetting } = await import("../src/lib/settings");
  const model = await getSetting("default_model_openai", "gpt-5.2");
  const provider = new OpenAIProvider();
  let text = "";
  let deltas = 0;
  for await (const delta of provider.generateStream({
    model,
    systemBlocks: [{ text: "Sos un copywriter. Respondé en una sola frase corta." }],
    messages: [{ role: "user", content: "Escribí un gancho de VSL para un curso de cocina." }],
    maxTokens: 1024,
  })) {
    text += delta;
    deltas++;
  }
  if (deltas === 0) throw new Error("OpenAI: el stream no emitió deltas");
  console.log(`✓ OpenAI OK — ${deltas} deltas`);
  console.log(`  "${text.slice(0, 100)}"`);
}

(async () => {
  try {
    await testAnthropic();
    await testOpenAI();
    console.log("Smoke test completo.");
  } catch (e) {
    console.error("✗ FALLÓ:", (e as Error).message);
    process.exit(1);
  }
})();
