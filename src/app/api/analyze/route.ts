import { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { countTokens } from "@/lib/ai/anthropic";
import { guardAdminRequest } from "@/lib/auth/session";
import { createVslAnalysis } from "@/lib/ai/analyze-vsl";

export const maxDuration = 300;

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

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(sse(data)));
      try {
        const analysisRun = await createVslAnalysis({ transcript, onStatus: (status) => send({ type: "status", ...status }) });
        let analysis = "";
        for await (const delta of analysisRun.stream) {
          analysis += delta;
          send({ type: "delta", text: delta });
        }

        // Guardar transcript + análisis como documento reutilizable
        const fullText = `# Transcript\n\n${transcript}\n\n---\n\n# Análisis estructural\n\n${analysis}`;
        const tokenCount = await countTokens(fullText, analysisRun.model);
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
