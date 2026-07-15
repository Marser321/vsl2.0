import { z } from "zod";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";
import { createVslAnalysis } from "@/lib/ai/analyze-vsl";
import { extractSocialTranscript, socialImportErrorMessage } from "@/lib/ingest/social";

export const runtime = "nodejs";
export const maxDuration = 300;

const inputSchema = z.object({
  url: z.string().url().max(2_000).optional(),
  storagePath: z.string().max(500).optional(),
  title: z.string().trim().max(240).optional(),
  clientId: z.number().int().positive().nullable().optional(),
}).refine((value) => Boolean(value.url) !== Boolean(value.storagePath), {
  message: "Enviá una URL o un upload, no ambos.",
});

function sse(data: unknown) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: Request) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const parsed = inputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(sse(data)));
      try {
        const extracted = await extractSocialTranscript({
          url: parsed.data.url,
          storagePath: parsed.data.storagePath,
          onProgress: (stage, detail) => send({ type: "status", stage, detail }),
        });
        send({ type: "transcript", text: extracted.text, title: extracted.title, platform: extracted.platform });
        send({ type: "status", stage: "analizando" });
        const analysisRun = await createVslAnalysis({
          transcript: extracted.text,
          onStatus: (status) => send({ type: "status", stage: status.stage, completed: status.completed, total: status.total }),
        });
        let analysis = "";
        for await (const delta of analysisRun.stream) {
          analysis += delta;
          send({ type: "delta", text: delta });
        }
        send({ type: "status", stage: "guardando" });
        const title = parsed.data.title?.trim() || extracted.title;
        const fullText = `# Fuente\n\n${extracted.sourceUrl || "Upload privado"}\n\n# Transcript\n\n${extracted.text}\n\n---\n\n# Análisis estructural\n\n${analysis}`;
        const [document] = await getDb().insert(documents).values({
          clientId: parsed.data.clientId ?? null,
          title: `[ANÁLISIS] ${title}`,
          kind: "transcript",
          sourceUrl: extracted.sourceUrl,
          sourcePlatform: extracted.platform,
          sourceMetadata: {
            ...extracted.metadata,
            transcriptionProvider: extracted.transcriptionProvider,
            transcriptionModel: extracted.transcriptionModel,
            analysisProvider: analysisRun.providerName,
            analysisModel: analysisRun.model,
          },
          extractedText: fullText,
          tokenCount: Math.ceil(fullText.length / 4),
          tags: ["competencia", "análisis", "social", extracted.platform],
        }).returning();
        send({ type: "done", documentId: document.id, title: document.title, clientId: document.clientId });
      } catch (error) {
        send({ type: "error", message: socialImportErrorMessage(error), uploadFallback: true });
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
      "X-Accel-Buffering": "no",
    },
  });
}
