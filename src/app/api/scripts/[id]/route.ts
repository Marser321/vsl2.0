import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { scripts, scriptVersions, scriptRatings, clients, documents, frameworks } from "@/db/schema";
import { and, asc, eq, inArray } from "drizzle-orm";
import { guardAdminRequest } from "@/lib/auth/session";
import { parsePromotionTags } from "@/lib/scripts/promotions";
import { effectiveScriptStatus } from "@/lib/generation/status";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const { id } = await params;
  const db = getDb();
  const [script] = await db
    .select()
    .from(scripts)
    .where(eq(scripts.id, Number(id)))
    .limit(1);
  if (!script)
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, script.clientId))
    .limit(1);
  const framework = script.frameworkId
    ? (await db.select().from(frameworks).where(eq(frameworks.id, script.frameworkId)).limit(1))[0]
    : null;
  const versions = await db
    .select()
    .from(scriptVersions)
    .where(eq(scriptVersions.scriptId, script.id))
    .orderBy(asc(scriptVersions.versionNumber));

  const ratings = versions.length
    ? await db
        .select()
        .from(scriptRatings)
        .where(inArray(scriptRatings.scriptVersionId, versions.map((v) => v.id)))
    : [];
  const byVersion = new Map(ratings.map((r) => [r.scriptVersionId, r]));
  const versionsWithRating = versions.map((v) => ({
    ...v,
    rating: byVersion.get(v.id) ?? null,
  }));

  const promotedDocs = await db
    .select({
      id: documents.id,
      tags: documents.tags,
      visibility: documents.visibility,
    })
    .from(documents)
    .where(
      and(
        eq(documents.sourceScriptId, script.id),
        eq(documents.kind, "winning_script")
      )
    );
  const promotions = promotedDocs.map((document) => ({
    documentId: document.id,
    ...parsePromotionTags(document.tags, document.visibility),
  }));

  return NextResponse.json({
    ...script,
    status: effectiveScriptStatus(script.status, script.generationHeartbeatAt),
    client,
    framework,
    versions: versionsWithRating,
    promotions,
  });
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (body.title !== undefined) updates.title = body.title;
  if (body.status !== undefined) updates.status = body.status;
  if (body.outcome !== undefined) updates.outcome = body.outcome;
  if (body.outcomeNotes !== undefined) updates.outcomeNotes = body.outcomeNotes;

  const [row] = await getDb()
    .update(scripts)
    .set(updates)
    .where(eq(scripts.id, Number(id)))
    .returning();
  if (!row)
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(_req, true); if (guard) return guard;
  const { id } = await params;
  await getDb().delete(scripts).where(eq(scripts.id, Number(id)));
  return NextResponse.json({ ok: true });
}
