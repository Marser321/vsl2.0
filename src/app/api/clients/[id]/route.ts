import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { guardAdminRequest } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const { id } = await params;
  const [row] = await getDb()
    .select()
    .from(clients)
    .where(eq(clients.id, Number(id)))
    .limit(1);
  if (!row)
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const { id } = await params;
  const body = await req.json();
  const [row] = await getDb()
    .update(clients)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.industry !== undefined ? { industry: body.industry } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      updatedAt: new Date(),
    })
    .where(eq(clients.id, Number(id)))
    .returning();
  if (!row)
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(_req, true); if (guard) return guard;
  const { id } = await params;
  await getDb().delete(clients).where(eq(clients.id, Number(id)));
  return NextResponse.json({ ok: true });
}
