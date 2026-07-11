import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { desc } from "drizzle-orm";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";

const clientSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  industry: z.string().optional().default(""),
  description: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export async function GET() {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const rows = await getDb().select().from(clients).orderBy(desc(clients.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const body = await req.json();
  const parsed = clientSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }
  const [row] = await getDb().insert(clients).values(parsed.data).returning();
  return NextResponse.json(row, { status: 201 });
}
