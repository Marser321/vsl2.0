import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { getProvider, type ProviderName } from "@/lib/ai/provider";
import { getSetting } from "@/lib/settings";
import { countTokens } from "@/lib/ai/anthropic";
import { guardAdminRequest } from "@/lib/auth/session";

export const maxDuration = 60;

const analyzeSchema = z.object({
  title: z.string().min(1, "Poné un título para identificar el VSL"),
  transcript: z.string().min(100, "Pegá el transcript completo (mínimo 100 caracteres)"),
  clientId: z.number().nullable().optional(),
});

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Analiza el transcript de un VSL de la competencia: framework detectado,
 * mapa de beats, ganchos, manejo de objeciones, CTAs. Al terminar guarda
 * transcript + análisis como documento kind='transcript' en la biblioteca.
 */
export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const parsed = analyzeSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { title, transcript, clientId } = parsed.data;

  const providerName = await getSetting("default_provider", "anthropic") as ProviderName;
  const model = await getSetting(
    providerName === "anthropic"
      ? "default_model_anthropic"
      : providerName === "openai"
        ? "default_model_openai"
        : "default_model_openrouter",
    providerName === "openrouter" ? "openrouter/ensemble-5+1" : "claude-opus-4-8"
  );
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(sse(data)));
      try {
        const provider = await getProvider(providerName);
        let analysis = "";
        for await (const delta of provider.generateStream({
          model,
          systemBlocks: [
            {
              text: `Sos un analista senior de VSLs de respuesta directa. Desarmás guiones ajenos para extraer su ingeniería persuasiva. Respondés en español, en Markdown, con precisión quirúrgica: citás frases textuales del transcript como evidencia.`,
              cache: true,
            },
          ],
          messages: [
            {
              role: "user",
              content: `Analizá este transcript de un VSL de la competencia y devolvé el desglose estructural completo:

# Formato de salida (Markdown)
## Ficha rápida
Producto/oferta detectada, audiencia objetivo, duración estimada, framework dominante (VSL clásico / PAS / AIDA / Star-Story-Solution / otro).
## Mapa de beats
Tabla: | # | Beat | Función persuasiva | Frase de apertura textual |
## Ganchos y re-enganches
El gancho inicial + cada re-enganche a lo largo del guion, citados textualmente, con por qué funcionan.
## Mecanismo único
Cómo presenta el "por qué esto funciona cuando lo demás falló".
## Prueba y credibilidad
Qué tipos de prueba usa (testimonios, datos, autoridad, demo) y cómo los secuencia.
## Manejo de objeciones
Qué objeciones ataca y con qué técnica (historia, garantía, reframe).
## Oferta y CTAs
Estructura de la oferta, apilamiento de valor, urgencia/escasez, cuántas veces pide la acción y cómo.
## Robable
Las 5-8 técnicas concretas de este VSL que vale la pena adaptar en nuestros guiones.

# Transcript
${transcript}`,
            },
          ],
          maxTokens: 16000,
          onStatus: (status) => send({ type: "status", ...status }),
        })) {
          analysis += delta;
          send({ type: "delta", text: delta });
        }

        // Guardar transcript + análisis como documento reutilizable
        const fullText = `# Transcript\n\n${transcript}\n\n---\n\n# Análisis estructural\n\n${analysis}`;
        const tokenCount = await countTokens(fullText, model);
        const [doc] = await getDb()
          .insert(documents)
          .values({
            clientId: clientId ?? null,
            title: `[ANÁLISIS] ${title}`,
            kind: "transcript",
            extractedText: fullText,
            tokenCount,
            tags: ["competencia", "análisis"],
          })
          .returning();

        send({ type: "done", documentId: doc.id });
      } catch (e) {
        send({ type: "error", message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
