import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { countTokens } from "@/lib/ai/anthropic";
import { getSetting } from "@/lib/settings";
import { getSupabaseAdmin, INTAKE_BUCKET } from "@/lib/supabase";
import { guardAdminRequest } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const { id } = await params;
  const [row] = await getDb()
    .select()
    .from(documents)
    .where(eq(documents.id, Number(id)))
    .limit(1);
  if (!row)
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const { id } = await params;
  const body = await req.json();

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.kind !== undefined) updates.kind = body.kind;
  if (body.isActive !== undefined) updates.isActive = body.isActive;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.extractedText !== undefined) {
    updates.extractedText = body.extractedText;
    const model = await getSetting("default_model_anthropic", "claude-opus-4-8");
    updates.tokenCount = await countTokens(body.extractedText, model);
  }

  const [row] = await getDb()
    .update(documents)
    .set(updates)
    .where(eq(documents.id, Number(id)))
    .returning();
  if (!row)
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(_req, true); if (guard) return guard;
  const { id } = await params;
  const [document] = await getDb().select().from(documents).where(eq(documents.id, Number(id))).limit(1);
  await getDb().delete(documents).where(eq(documents.id, Number(id)));
  if (document?.filePath) await getSupabaseAdmin().storage.from(INTAKE_BUCKET).remove([document.filePath]);
  return NextResponse.json({ ok: true });
}
