import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/db";
import { scripts, scriptVersions } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";
import { generationInputSchema } from "@/lib/generation/schema";
import { effectiveScriptStatus } from "@/lib/generation/status";
import { createGenerationStream } from "@/lib/generation/stream";

export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;

  const scriptId = Number((await params).id);
  if (!Number.isInteger(scriptId) || scriptId < 1) {
    return Response.json({ error: "Guion inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const db = getDb();
  const [script] = await db.select().from(scripts).where(eq(scripts.id, scriptId)).limit(1);
  if (!script) return Response.json({ error: "Guion no encontrado" }, { status: 404 });

  const status = effectiveScriptStatus(script.status, script.generationHeartbeatAt);
  if (status !== "failed" && status !== "interrupted") {
    return Response.json(
      { error: status === "generating" ? "La generación todavía está activa" : "Este guion no necesita reintento" },
      { status: 409 }
    );
  }
  if (script.provider === "openai") {
    return Response.json(
      { error: "OpenAI está deshabilitado. Creá una generación nueva con OpenRouter para conservar este parcial." },
      { status: 409 }
    );
  }

  const [lastVersion] = await db
    .select()
    .from(scriptVersions)
    .where(eq(scriptVersions.scriptId, script.id))
    .orderBy(desc(scriptVersions.versionNumber))
    .limit(1);
  if (!lastVersion) return Response.json({ error: "El guion no tiene un borrador recuperable" }, { status: 400 });

  const parsed = generationInputSchema.safeParse({
    clientId: script.clientId,
    brandId: script.brandId,
    offerId: script.offerId,
    campaignId: script.campaignId,
    frameworkId: script.frameworkId,
    documentIds: lastVersion.generationParams.documentIds,
    title: script.title,
    format: script.format,
    provider: script.provider,
    model: script.model,
    openrouterConfirmed: body.openrouterConfirmed,
    brief: script.brief,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return Response.json({ error: issue.message, path: issue.path }, { status: 400 });
  }

  try {
    return await createGenerationStream(parsed.data, script.id);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 400 });
  }
}
