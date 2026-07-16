import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { analysisJobs, documents } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";
import { createVslAnalysis } from "@/lib/ai/analyze-vsl";
import { extractSocialTranscript, socialImportErrorMessage } from "@/lib/ingest/social";

export const runtime = "nodejs";
export const maxDuration = 300;

const CHECKPOINT_INTERVAL_MS = 1_500;

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

  const db = getDb();
  // El trabajo se persiste desde el arranque: si el usuario cierra la
  // pestaña, /analizador puede seguir mostrando si sigue vivo o falló.
  const [job] = await db.insert(analysisJobs).values({
    clientId: parsed.data.clientId ?? null,
    title: parsed.data.title?.trim() || (parsed.data.url ?? "Upload privado"),
    sourceUrl: parsed.data.url ?? null,
    storagePath: parsed.data.storagePath ?? null,
    status: "processing",
    stage: "validando",
  }).returning({ id: analysisJobs.id });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let clientConnected = true;
      const send = (data: unknown) => {
        if (!clientConnected) return;
        try {
          controller.enqueue(encoder.encode(sse(data)));
        } catch {
          clientConnected = false;
        }
      };
      let lastCheckpointAt = 0;
      const touch = (fields: Partial<typeof analysisJobs.$inferInsert>, force = false) => {
        if (!force && Date.now() - lastCheckpointAt < CHECKPOINT_INTERVAL_MS) return;
        lastCheckpointAt = Date.now();
        const now = new Date();
        void db.update(analysisJobs)
          .set({ ...fields, heartbeatAt: now, updatedAt: now })
          .where(eq(analysisJobs.id, job.id))
          .catch(() => undefined);
      };

      send({ type: "started", jobId: job.id });
      try {
        const extracted = await extractSocialTranscript({
          url: parsed.data.url,
          storagePath: parsed.data.storagePath,
          onProgress: (stage, detail) => {
            send({ type: "status", stage, detail });
            touch({ stage }, true);
          },
        });
        send({ type: "transcript", text: extracted.text, title: extracted.title, platform: extracted.platform });
        touch({ transcript: extracted.text, title: parsed.data.title?.trim() || extracted.title }, true);
        send({ type: "status", stage: "analizando" });
        const analysisRun = await createVslAnalysis({
          transcript: extracted.text,
          onStatus: (status) => {
            send({ type: "status", stage: status.stage, completed: status.completed, total: status.total });
            touch({ stage: "analizando" });
          },
        });
        let analysis = "";
        for await (const delta of analysisRun.stream) {
          analysis += delta;
          send({ type: "delta", text: delta });
          touch({ analysis });
        }
        send({ type: "status", stage: "guardando" });
        const title = parsed.data.title?.trim() || extracted.title;
        const fullText = `# Fuente\n\n${extracted.sourceUrl || "Upload privado"}\n\n# Transcript\n\n${extracted.text}\n\n---\n\n# Análisis estructural\n\n${analysis}`;
        const [document] = await db.insert(documents).values({
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
        await db.update(analysisJobs)
          .set({
            status: "ready",
            stage: null,
            analysis,
            documentId: document.id,
            title: document.title,
            error: null,
            heartbeatAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(analysisJobs.id, job.id));
        send({ type: "done", documentId: document.id, title: document.title, clientId: document.clientId });
      } catch (error) {
        const message = socialImportErrorMessage(error);
        await db.update(analysisJobs)
          .set({ status: "failed", error: message, heartbeatAt: new Date(), updatedAt: new Date() })
          .where(eq(analysisJobs.id, job.id))
          .catch(() => undefined);
        send({ type: "error", message, uploadFallback: true });
      } finally {
        try {
          controller.close();
        } catch {
          // El cliente ya se había desconectado; el estado quedó en la DB.
        }
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
