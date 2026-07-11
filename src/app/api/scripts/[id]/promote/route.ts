import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { documents, scripts, scriptVersions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { countTokens } from "@/lib/ai/anthropic";
import { getSetting } from "@/lib/settings";
import { guardAdminRequest } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

/**
 * Promueve la última versión de un guion ganador a la biblioteca como
 * documento kind='winning_script' — queda como ejemplo few-shot para
 * futuras generaciones.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const scope: "client" | "global" = body.scope === "global" ? "global" : "client";

  const db = getDb();
  const [script] = await db
    .select()
    .from(scripts)
    .where(eq(scripts.id, Number(id)))
    .limit(1);
  if (!script)
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const [lastVersion] = await db
    .select()
    .from(scriptVersions)
    .where(eq(scriptVersions.scriptId, script.id))
    .orderBy(desc(scriptVersions.versionNumber))
    .limit(1);
  if (!lastVersion)
    return NextResponse.json({ error: "El guion no tiene versiones" }, { status: 400 });

  const model = await getSetting("default_model_anthropic", "claude-opus-4-8");
  const tokenCount = await countTokens(lastVersion.content, model);

  const [doc] = await db
    .insert(documents)
    .values({
      clientId: scope === "client" ? script.clientId : null,
      brandId: scope === "client" ? script.brandId : null,
      offerId: scope === "client" ? script.offerId : null,
      campaignId: scope === "client" ? script.campaignId : null,
      visibility: scope === "client" ? "private" : "global",
      title: `[GANADOR] ${script.title}`,
      kind: "winning_script",
      extractedText: lastVersion.content,
      tokenCount,
      tags: ["promovido"],
    })
    .returning();

  await db.update(scripts)
    .set({ outcome: "won", status: "final" })
    .where(eq(scripts.id, script.id));

  return NextResponse.json(doc, { status: 201 });
}
