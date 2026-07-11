import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { RATING_TAGS, scriptRatings, scripts, scriptVersions } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";

const ratingSchema = z.object({
  versionId: z.number().int().positive(),
  score: z.number().int().min(1).max(5),
  tags: z.array(z.enum(RATING_TAGS)).max(8).default([]),
  notes: z.string().max(2000).default(""),
});

type Params = { params: Promise<{ id: string }> };

/** Puntuación del equipo sobre una versión (1-5★). Re-puntuar actualiza. */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const { id } = await params;
  const parsed = ratingSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { versionId, score, tags, notes } = parsed.data;

  const db = getDb();
  const [version] = await db
    .select({ id: scriptVersions.id, scriptId: scriptVersions.scriptId })
    .from(scriptVersions)
    .where(eq(scriptVersions.id, versionId))
    .limit(1);
  if (!version || version.scriptId !== Number(id)) {
    return NextResponse.json({ error: "La versión no pertenece a este guion" }, { status: 404 });
  }

  const [row] = await db
    .insert(scriptRatings)
    .values({ scriptVersionId: versionId, score, tags, notes: notes || null })
    .onConflictDoUpdate({
      target: scriptRatings.scriptVersionId,
      set: { score, tags, notes: notes || null, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json(row, { status: 201 });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest();
  if (guard) return guard;
  const { id } = await params;
  const db = getDb();
  const [script] = await db
    .select({ id: scripts.id })
    .from(scripts)
    .where(eq(scripts.id, Number(id)))
    .limit(1);
  if (!script) return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const versionIds = (
    await db
      .select({ id: scriptVersions.id })
      .from(scriptVersions)
      .where(eq(scriptVersions.scriptId, script.id))
  ).map((v) => v.id);
  const ratings = versionIds.length
    ? await db.select().from(scriptRatings).where(inArray(scriptRatings.scriptVersionId, versionIds))
    : [];
  return NextResponse.json(ratings);
}
