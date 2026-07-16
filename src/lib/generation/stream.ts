import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { scripts, scriptVersions } from "@/db/schema";
import { buildContext } from "@/lib/ai/context-builder";
import { getProvider } from "@/lib/ai/provider";
import { describeAiError } from "@/lib/ai/errors";
import type { GenerationInput } from "./schema";

const CHECKPOINT_INTERVAL_MS = 1_500;
const CHECKPOINT_CHARS = 2_048;

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

export async function createGenerationStream(
  input: GenerationInput,
  retryScriptId?: number
): Promise<Response> {
  const context = await buildContext({
    clientId: input.clientId,
    brandId: input.brandId,
    offerId: input.offerId,
    campaignId: input.campaignId,
    frameworkId: input.frameworkId,
    documentIds: input.documentIds,
    brief: input.brief,
    format: input.format,
  });

  const db = getDb();
  const now = new Date();
  const prepared = await db.transaction(async (tx) => {
    let scriptId: number;
    let versionNumber = 1;

    if (retryScriptId) {
      await tx.execute(sql`select pg_advisory_xact_lock(${retryScriptId})`);
      const [script] = await tx
        .select({ id: scripts.id })
        .from(scripts)
        .where(eq(scripts.id, retryScriptId))
        .limit(1);
      if (!script) throw new Error("Guion no encontrado");
      const [lastVersion] = await tx
        .select({ versionNumber: scriptVersions.versionNumber })
        .from(scriptVersions)
        .where(eq(scriptVersions.scriptId, retryScriptId))
        .orderBy(desc(scriptVersions.versionNumber))
        .limit(1);
      versionNumber = (lastVersion?.versionNumber ?? 0) + 1;
      scriptId = retryScriptId;
      await tx
        .update(scripts)
        .set({
          provider: input.provider,
          model: input.model,
          status: "generating",
          generationError: null,
          generationStartedAt: now,
          generationHeartbeatAt: now,
          updatedAt: now,
        })
        .where(eq(scripts.id, scriptId));
    } else {
      const [script] = await tx
        .insert(scripts)
        .values({
          clientId: input.clientId,
          brandId: input.brandId ?? null,
          offerId: input.offerId ?? null,
          campaignId: input.campaignId ?? null,
          frameworkId: input.frameworkId,
          title: input.title,
          brief: input.brief,
          format: input.format,
          provider: input.provider,
          model: input.model,
          status: "generating",
          generationStartedAt: now,
          generationHeartbeatAt: now,
        })
        .returning({ id: scripts.id });
      scriptId = script.id;
    }

    const [version] = await tx
      .insert(scriptVersions)
      .values({
        scriptId,
        versionNumber,
        content: "",
        generationParams: {
          provider: input.provider,
          model: input.model,
          documentIds: context.includedDocumentIds,
          frameworkId: input.frameworkId,
          contextSnapshot: {
            ...context.snapshot,
            brandId: input.brandId ?? undefined,
            offerId: input.offerId ?? undefined,
            campaignId: input.campaignId ?? undefined,
          },
        },
      })
      .returning({ id: scriptVersions.id });

    return { scriptId, versionId: version.id, versionNumber };
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let clientConnected = true;
      let content = "";
      let lastCheckpointAt = Date.now();
      let lastCheckpointLength = 0;

      const send = (data: unknown) => {
        if (!clientConnected) return;
        try {
          controller.enqueue(encoder.encode(sse(data)));
        } catch {
          clientConnected = false;
        }
      };
      const close = () => {
        if (!clientConnected) return;
        try {
          controller.close();
        } catch {
          clientConnected = false;
        }
      };
      const checkpoint = async (force = false) => {
        const elapsed = Date.now() - lastCheckpointAt;
        const added = content.length - lastCheckpointLength;
        if (!force && elapsed < CHECKPOINT_INTERVAL_MS && added < CHECKPOINT_CHARS) return;
        const checkpointAt = new Date();
        await db
          .update(scriptVersions)
          .set({ content, updatedAt: checkpointAt })
          .where(eq(scriptVersions.id, prepared.versionId));
        await db
          .update(scripts)
          .set({ generationHeartbeatAt: checkpointAt, updatedAt: checkpointAt })
          .where(eq(scripts.id, prepared.scriptId));
        lastCheckpointAt = Date.now();
        lastCheckpointLength = content.length;
      };

      send({
        type: "started",
        ...prepared,
        provider: input.provider,
        model: input.model,
      });

      try {
        const provider = await getProvider(input.provider);
        for await (const delta of provider.generateStream({
          model: input.model,
          systemBlocks: context.systemBlocks,
          messages: context.messages,
          maxTokens: 64_000,
          onStatus: (status) => {
            send({ type: "status", ...status });
            // El arnés 5+1 puede pasar varios minutos construyendo propuestas
            // antes de emitir el primer delta. Mantener vivo el heartbeat evita
            // clasificar como interrumpido un trabajo que sigue activo.
            const heartbeatAt = new Date();
            void db
              .update(scripts)
              .set({ generationHeartbeatAt: heartbeatAt, updatedAt: heartbeatAt })
              .where(eq(scripts.id, prepared.scriptId))
              .catch(() => undefined);
          },
        })) {
          content += delta;
          send({ type: "delta", text: delta });
          await checkpoint();
        }

        const usage = provider.getFinalUsage();
        const completedAt = new Date();
        await db.transaction(async (tx) => {
          await tx
            .update(scriptVersions)
            .set({ content, usage, updatedAt: completedAt })
            .where(eq(scriptVersions.id, prepared.versionId));
          await tx
            .update(scripts)
            .set({
              status: "draft",
              generationError: null,
              generationHeartbeatAt: completedAt,
              updatedAt: completedAt,
            })
            .where(eq(scripts.id, prepared.scriptId));
        });
        send({ type: "done", ...prepared, usage });
      } catch (error) {
        const message = describeAiError(error);
        const failedAt = new Date();
        try {
          await db.transaction(async (tx) => {
            await tx
              .update(scriptVersions)
              .set({ content, updatedAt: failedAt })
              .where(eq(scriptVersions.id, prepared.versionId));
            await tx
              .update(scripts)
              .set({
                status: "failed",
                generationError: message,
                generationHeartbeatAt: failedAt,
                updatedAt: failedAt,
              })
              .where(eq(scripts.id, prepared.scriptId));
          });
        } catch {
          // El error original es más útil para el cliente; el último checkpoint ya quedó persistido.
        }
        send({
          type: "error",
          message,
          ...prepared,
          recoverable: true,
        });
      } finally {
        close();
      }
    },
    cancel() {
      // No cancelamos el provider: el trabajo continúa y sigue guardando checkpoints.
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
