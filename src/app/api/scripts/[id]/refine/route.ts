import { NextRequest } from "next/server";
import { getDb } from "@/db";
import { scripts, scriptVersions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { buildContext } from "@/lib/ai/context-builder";
import { getProvider } from "@/lib/ai/provider";
import { renderBriefMessage } from "@/lib/ai/prompts";
import { frameworks } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";

export const maxDuration = 300;

const refineSchema = z.object({
  instruction: z.string().min(1, "Escribí la instrucción de ajuste"),
  versionId: z.number().int().positive().optional(),
});

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`;
}

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const { id } = await params;
  const parsed = refineSchema.safeParse(await req.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { instruction, versionId } = parsed.data;

  const db = getDb();
  const [script] = await db
    .select()
    .from(scripts)
    .where(eq(scripts.id, Number(id)))
    .limit(1);
  if (!script) {
    return Response.json({ error: "Guion no encontrado" }, { status: 404 });
  }

  const versions = await db
    .select()
    .from(scriptVersions)
    .where(eq(scriptVersions.scriptId, script.id))
    .orderBy(desc(scriptVersions.versionNumber));
  const lastVersion = versions[0];
  if (!lastVersion) {
    return Response.json({ error: "El guion no tiene versiones" }, { status: 400 });
  }
  const baseVersion = versionId
    ? versions.find((version) => version.id === versionId)
    : lastVersion;
  if (!baseVersion) {
    return Response.json({ error: "La versión no pertenece a este guion" }, { status: 404 });
  }

  const framework = script.frameworkId
    ? ((await db.select().from(frameworks).where(eq(frameworks.id, script.frameworkId)).limit(1))[0] ?? null)
    : null;

  // Historial multi-turno: brief original → última versión → instrucción de ajuste.
  // Reusa los mismos bloques system cacheados de la generación original.
  const context = await buildContext({
    clientId: script.clientId,
    brandId: script.brandId,
    offerId: script.offerId,
    campaignId: script.campaignId,
    frameworkId: script.frameworkId,
    documentIds: baseVersion.generationParams.documentIds,
    brief: script.brief,
    format: script.format,
    history: [
      { role: "user", content: renderBriefMessage({ brief: script.brief, framework, format: script.format }) },
      { role: "assistant", content: baseVersion.content },
      {
        role: "user",
        content: `Ajustá el guion según esta instrucción y devolvé el guion COMPLETO actualizado (mismo formato Markdown):\n\n${instruction}`,
      },
    ],
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => controller.enqueue(encoder.encode(sse(data)));
      try {
        // script.provider es el tipo histórico de la columna (puede tener
        // valores de proveedores viejos ya deshabilitados); OpenRouter es el
        // único proveedor operativo.
        const provider = await getProvider("openrouter");
        let content = "";
        for await (const delta of provider.generateStream({
          model: script.model,
          systemBlocks: context.systemBlocks,
          messages: context.messages,
          maxTokens: 64000,
          onStatus: (status) => send({ type: "status", ...status }),
        })) {
          content += delta;
          send({ type: "delta", text: delta });
        }

        const usage = provider.getFinalUsage();
        const [version] = await db
          .insert(scriptVersions)
          .values({
            scriptId: script.id,
            versionNumber: lastVersion.versionNumber + 1,
            content,
            generationParams: baseVersion.generationParams,
            refinementInstruction: instruction,
            usage,
          })
          .returning();

        send({ type: "done", scriptId: script.id, versionId: version.id, usage });
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
