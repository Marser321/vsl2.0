import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { frameworks, templates } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";

export async function GET() {
  const guard = await guardAdminRequest();
  if (guard) return guard;
  const rows = await getDb()
    .select({
      id: templates.id,
      slug: templates.slug,
      title: templates.title,
      format: templates.format,
      frameworkId: templates.frameworkId,
      frameworkName: frameworks.name,
      description: templates.description,
      briefDefaults: templates.briefDefaults,
      contentMd: templates.contentMd,
      isBuiltin: templates.isBuiltin,
      createdAt: templates.createdAt,
    })
    .from(templates)
    .leftJoin(frameworks, eq(templates.frameworkId, frameworks.id))
    .orderBy(asc(templates.format), asc(templates.id));
  return NextResponse.json(rows);
}

const templateSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug inválido (solo a-z, 0-9 y guiones)"),
  title: z.string().min(1),
  format: z.enum(["vsl", "reel"]).default("vsl"),
  frameworkId: z.number().int().nullable().default(null),
  description: z.string().default(""),
  briefDefaults: z.record(z.string(), z.unknown()).default({}),
  contentMd: z.string().min(1, "La plantilla no puede estar vacía"),
});

export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const parsed = templateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const db = getDb();
  const [existing] = await db
    .select({ id: templates.id })
    .from(templates)
    .where(eq(templates.slug, parsed.data.slug))
    .limit(1);
  if (existing) {
    return NextResponse.json({ error: "Ya existe una plantilla con ese nombre/slug" }, { status: 409 });
  }
  const [row] = await db
    .insert(templates)
    .values({ ...parsed.data, isBuiltin: false })
    .returning();
  return NextResponse.json(row, { status: 201 });
}
