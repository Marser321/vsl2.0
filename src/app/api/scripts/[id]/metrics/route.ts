import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { PLATFORMS, scriptMetrics, scripts, scriptVersions } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";

const metricSchema = z
  .object({
    versionId: z.number().int(),
    platform: z.enum(PLATFORMS),
    hookRate: z.number().min(0).max(100).nullable().optional(),
    ctr: z.number().min(0).max(100).nullable().optional(),
    cpa: z.number().min(0).nullable().optional(),
    impressions: z.number().int().min(0).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
  })
  .refine(
    (data) => [data.hookRate, data.ctr, data.cpa, data.impressions].some(
      (value) => value !== null && value !== undefined
    ),
    { message: "Cargá al menos una métrica numérica" }
  );

const metricKeySchema = z.object({
  versionId: z.number().int(),
  platform: z.enum(PLATFORMS),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest();
  if (guard) return guard;
  const { id } = await params;
  const scriptId = Number(id);
  const db = getDb();
  const [script] = await db
    .select({ id: scripts.id })
    .from(scripts)
    .where(eq(scripts.id, scriptId))
    .limit(1);
  if (!script) return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const metrics = await db
    .select({
      id: scriptMetrics.id,
      scriptVersionId: scriptMetrics.scriptVersionId,
      platform: scriptMetrics.platform,
      hookRate: scriptMetrics.hookRate,
      ctr: scriptMetrics.ctr,
      cpa: scriptMetrics.cpa,
      impressions: scriptMetrics.impressions,
      notes: scriptMetrics.notes,
      capturedAt: scriptMetrics.capturedAt,
      updatedAt: scriptMetrics.updatedAt,
      versionNumber: scriptVersions.versionNumber,
    })
    .from(scriptMetrics)
    .innerJoin(scriptVersions, eq(scriptMetrics.scriptVersionId, scriptVersions.id))
    .where(eq(scriptVersions.scriptId, scriptId));

  return NextResponse.json({ metrics });
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const { id } = await params;
  const parsed = metricSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const scriptId = Number(id);
  const { versionId, platform, hookRate, ctr, cpa, impressions, notes } = parsed.data;
  const db = getDb();
  const [version] = await db
    .select({ id: scriptVersions.id, scriptId: scriptVersions.scriptId })
    .from(scriptVersions)
    .where(eq(scriptVersions.id, versionId))
    .limit(1);
  if (!version || version.scriptId !== scriptId) {
    return NextResponse.json({ error: "La versión no pertenece a este guion" }, { status: 404 });
  }

  const values = {
    scriptVersionId: versionId,
    platform,
    hookRate: hookRate ?? null,
    ctr: ctr ?? null,
    cpa: cpa ?? null,
    impressions: impressions ?? null,
    notes: notes?.trim() || null,
  };
  const [metric] = await db
    .insert(scriptMetrics)
    .values(values)
    .onConflictDoUpdate({
      target: [scriptMetrics.scriptVersionId, scriptMetrics.platform],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return NextResponse.json(metric, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const { id } = await params;
  const parsed = metricKeySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const scriptId = Number(id);
  const { versionId, platform } = parsed.data;
  const db = getDb();
  const [version] = await db
    .select({ id: scriptVersions.id, scriptId: scriptVersions.scriptId })
    .from(scriptVersions)
    .where(eq(scriptVersions.id, versionId))
    .limit(1);
  if (!version || version.scriptId !== scriptId) {
    return NextResponse.json({ error: "La versión no pertenece a este guion" }, { status: 404 });
  }

  await db
    .delete(scriptMetrics)
    .where(
      and(
        eq(scriptMetrics.scriptVersionId, versionId),
        eq(scriptMetrics.platform, platform)
      )
    );
  return NextResponse.json({ ok: true });
}
