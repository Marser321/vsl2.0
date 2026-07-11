import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { frameworks } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const format = req.nextUrl.searchParams.get("format");
  const db = getDb();
  const rows =
    format === "vsl" || format === "reel"
      ? await db.select().from(frameworks).where(eq(frameworks.format, format)).orderBy(asc(frameworks.id))
      : await db.select().from(frameworks).orderBy(asc(frameworks.id));
  return NextResponse.json(rows);
}

const frameworkSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().default(""),
  structureMd: z.string().min(1),
  format: z.enum(["vsl", "reel"]).default("vsl"),
});

export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const parsed = frameworkSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const [row] = await getDb().insert(frameworks).values(parsed.data).returning();
  return NextResponse.json(row, { status: 201 });
}
