import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { critiques, scriptRatings, scripts, scriptVersions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";
import { shouldCoalesce } from "@/lib/versions";

const saveVersionSchema = z.object({
  content: z.string().min(1, "El guion no puede quedar vacío").max(300_000),
  baseVersionId: z.number().int().positive().optional(),
});

type Params = { params: Promise<{ id: string }> };

function isUniqueViolation(e: unknown): boolean {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/** Guardado manual del cuerpo del guion (editor). Coalesce o crea versión nueva. */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const { id } = await params;
  const parsed = saveVersionSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const { content, baseVersionId } = parsed.data;

  const db = getDb();
  const [script] = await db
    .select()
    .from(scripts)
    .where(eq(scripts.id, Number(id)))
    .limit(1);
  if (!script) {
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });
  }

  const loadLatest = async () => {
    const [latest] = await db
      .select()
      .from(scriptVersions)
      .where(eq(scriptVersions.scriptId, script.id))
      .orderBy(desc(scriptVersions.versionNumber))
      .limit(1);
    return latest ?? null;
  };

  const latest = await loadLatest();
  if (!latest) {
    return NextResponse.json({ error: "El guion no tiene versiones" }, { status: 400 });
  }

  const [crit] = await db
    .select({ id: critiques.id })
    .from(critiques)
    .where(eq(critiques.scriptVersionId, latest.id))
    .limit(1);
  const [rating] = await db
    .select({ id: scriptRatings.id })
    .from(scriptRatings)
    .where(eq(scriptRatings.scriptVersionId, latest.id))
    .limit(1);
  const hasDependents = Boolean(crit || rating);

  const touchScript = () =>
    db.update(scripts).set({ updatedAt: new Date() }).where(eq(scripts.id, script.id));

  if (shouldCoalesce({ id: latest.id, source: latest.source }, baseVersionId, hasDependents)) {
    const [version] = await db
      .update(scriptVersions)
      .set({ content, updatedAt: new Date() })
      .where(eq(scriptVersions.id, latest.id))
      .returning();
    await touchScript();
    return NextResponse.json({ version, coalesced: true });
  }

  const insertNext = async (base: NonNullable<Awaited<ReturnType<typeof loadLatest>>>) => {
    const [version] = await db
      .insert(scriptVersions)
      .values({
        scriptId: script.id,
        versionNumber: base.versionNumber + 1,
        content,
        generationParams: base.generationParams,
        refinementInstruction: null,
        source: "manual",
        usage: null,
      })
      .returning();
    return version;
  };

  try {
    const version = await insertNext(latest);
    await touchScript();
    return NextResponse.json({ version, coalesced: false }, { status: 201 });
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    // Carrera con otra pestaña/refinamiento: re-leer la última y reintentar UNA vez.
    const fresh = await loadLatest();
    if (fresh) {
      try {
        const version = await insertNext(fresh);
        await touchScript();
        return NextResponse.json({ version, coalesced: false }, { status: 201 });
      } catch (e2) {
        if (!isUniqueViolation(e2)) throw e2;
      }
    }
    return NextResponse.json(
      { error: "Otra pestaña creó una versión nueva. Recargá la página." },
      { status: 409 }
    );
  }
}
