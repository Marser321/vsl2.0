import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { documents, scripts, scriptVersions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { countTokens } from "@/lib/ai/anthropic";
import { getSetting } from "@/lib/settings";
import { guardAdminRequest } from "@/lib/auth/session";
import { z } from "zod";
import { promotionScopeTag, promotionVersionTag } from "@/lib/scripts/promotions";

const promoteSchema = z.object({
  scope: z.enum(["client", "global"]).default("client"),
  versionId: z.number().int().positive().optional(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * Promueve una versión de un guion ganador a la biblioteca como
 * documento kind='winning_script' — queda como ejemplo few-shot para
 * futuras generaciones.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const { id } = await params;
  const parsed = promoteSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { scope, versionId } = parsed.data;

  const db = getDb();
  const [script] = await db
    .select()
    .from(scripts)
    .where(eq(scripts.id, Number(id)))
    .limit(1);
  if (!script)
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const versions = await db
    .select()
    .from(scriptVersions)
    .where(eq(scriptVersions.scriptId, script.id))
    .orderBy(desc(scriptVersions.versionNumber));
  const lastVersion = versions[0];
  if (!lastVersion)
    return NextResponse.json({ error: "El guion no tiene versiones" }, { status: 400 });
  const targetVersion = versionId
    ? versions.find((version) => version.id === versionId)
    : lastVersion;
  if (!targetVersion) {
    return NextResponse.json({ error: "La versión no pertenece a este guion" }, { status: 404 });
  }

  const versionTag = promotionVersionTag(targetVersion.id);
  const scopeTag = promotionScopeTag(scope);
  const promotedDocs = await db
    .select()
    .from(documents)
    .where(eq(documents.sourceScriptId, script.id));
  const existing = promotedDocs.find(
    (document) =>
      document.kind === "winning_script" &&
      document.tags.includes(versionTag) &&
      document.tags.includes(scopeTag)
  );
  if (existing) {
    await db.update(scripts)
      .set({ outcome: "won", status: "final" })
      .where(eq(scripts.id, script.id));
    return NextResponse.json({ ...existing, alreadyPromoted: true });
  }

  const model = await getSetting("default_model_anthropic", "claude-opus-4-8");
  const tokenCount = await countTokens(targetVersion.content, model);

  const [doc] = await db
    .insert(documents)
    .values({
      clientId: scope === "client" ? script.clientId : null,
      brandId: scope === "client" ? script.brandId : null,
      offerId: scope === "client" ? script.offerId : null,
      campaignId: scope === "client" ? script.campaignId : null,
      visibility: scope === "client" ? "private" : "global",
      title: `[GANADOR v${targetVersion.versionNumber}] ${script.title}`,
      kind: "winning_script",
      extractedText: targetVersion.content,
      tokenCount,
      tags: ["promovido", versionTag, scopeTag],
      // Enlace al guion de origen: permite rankear este ejemplar por su puntuación.
      sourceScriptId: script.id,
    })
    .returning();

  await db.update(scripts)
    .set({ outcome: "won", status: "final" })
    .where(eq(scripts.id, script.id));

  return NextResponse.json({ ...doc, alreadyPromoted: false }, { status: 201 });
}
