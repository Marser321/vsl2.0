import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { industryLearnings } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";

export async function GET() {
  const guard = await guardAdminRequest(); if (guard) return guard;
  return NextResponse.json(await getDb().select().from(industryLearnings).orderBy(desc(industryLearnings.createdAt)));
}

export async function PATCH(req: NextRequest) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const parsed = z.object({ id: z.number().int().positive(), active: z.boolean() }).safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const [row] = await getDb().update(industryLearnings).set({ isActive: parsed.data.active, approvedAt: parsed.data.active ? new Date() : null }).where(eq(industryLearnings.id, parsed.data.id)).returning();
  if (!row) return NextResponse.json({ error: "Aprendizaje no encontrado" }, { status: 404 });
  return NextResponse.json(row);
}
