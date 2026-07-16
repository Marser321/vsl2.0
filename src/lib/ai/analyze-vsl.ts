import { getProvider } from "./provider";
import { getSetting } from "@/lib/settings";

export async function createVslAnalysis(args: {
  transcript: string;
  onStatus?: (status: { stage: string; completed?: number; total?: number }) => void;
}) {
  const providerName = "openrouter" as const;
  const model = await getSetting("default_model_openrouter", "openrouter/ensemble-5+1");
  const provider = await getProvider(providerName);
  const stream = provider.generateStream({
    model,
    systemBlocks: [{
      text: "Sos un analista senior de VSLs de respuesta directa. Extraés ingeniería persuasiva y patrones adaptables sin reproducir extensamente frases distintivas del original. Respondés en español, en Markdown, con precisión y evidencia breve.",
      cache: true,
    }],
    messages: [{
      role: "user",
      content: `Analizá este transcript y devolvé el desglose estructural completo:

# Formato de salida (Markdown)
## Ficha rápida
Producto/oferta detectada, audiencia, duración estimada y framework dominante.
## Mapa de beats
Tabla: | # | Beat | Función persuasiva | Evidencia breve |
## Ganchos y re-enganches
Gancho inicial y re-enganches, con por qué funcionan.
## Mecanismo único
Cómo explica por qué esto funciona cuando lo demás falló.
## Prueba y credibilidad
Tipos de prueba y secuencia.
## Manejo de objeciones
Objeciones y técnicas usadas.
## Oferta y CTAs
Oferta, valor, urgencia legítima y llamados a la acción.
## Principios adaptables
Entre 5 y 8 técnicas que se pueden reinterpretar para otra marca. No copies párrafos ni frases distintivas; describí el patrón y cómo aplicarlo de manera original.

# Transcript
${args.transcript}`,
    }],
    maxTokens: 16_000,
    onStatus: args.onStatus,
  });
  return { providerName, model, stream };
}
