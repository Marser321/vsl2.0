import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { templates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { guardAdminRequest } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const { id } = await params;
  await getDb().delete(templates).where(eq(templates.id, Number(id)));
  return NextResponse.json({ ok: true });
}
