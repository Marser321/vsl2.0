import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { brands, clients, intakeRequests, intakeSubmissions, offers } from "@/db/schema";
import { assertSameOrigin, isAdminSession } from "@/lib/auth/session";
import { createAccessToken } from "@/lib/intake/access";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  brandId: z.number().int().positive().nullable().optional(),
  offerId: z.number().int().positive().nullable().optional(),
  title: z.string().trim().min(1).max(240),
});

export async function GET() {
  if (!(await isAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const rows = await getDb()
    .select({
      id: intakeRequests.id,
      publicId: intakeRequests.publicId,
      title: intakeRequests.title,
      status: intakeRequests.status,
      expiresAt: intakeRequests.expiresAt,
      createdAt: intakeRequests.createdAt,
      submittedAt: intakeRequests.submittedAt,
      clientId: intakeRequests.clientId,
      clientName: clients.name,
      brandName: brands.name,
      offerName: offers.name,
    })
    .from(intakeRequests)
    .leftJoin(clients, eq(intakeRequests.clientId, clients.id))
    .leftJoin(brands, eq(intakeRequests.brandId, brands.id))
    .leftJoin(offers, eq(intakeRequests.offerId, offers.id))
    .orderBy(desc(intakeRequests.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  assertSameOrigin(req);
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const db = getDb();
  const [client] = await db.select().from(clients).where(eq(clients.id, parsed.data.clientId)).limit(1);
  if (!client) return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  if (parsed.data.brandId) {
    const [brand] = await db.select().from(brands).where(eq(brands.id, parsed.data.brandId)).limit(1);
    if (!brand || brand.clientId !== parsed.data.clientId) return NextResponse.json({ error: "La marca no pertenece al cliente." }, { status: 400 });
  }
  if (parsed.data.offerId) {
    const [offer] = await db.select().from(offers).where(eq(offers.id, parsed.data.offerId)).limit(1);
    if (!offer || !parsed.data.brandId || offer.brandId !== parsed.data.brandId) return NextResponse.json({ error: "La oferta no pertenece a la marca." }, { status: 400 });
  }
  const { token, hash } = createAccessToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const [request] = await db.insert(intakeRequests).values({
    clientId: parsed.data.clientId,
    brandId: parsed.data.brandId ?? null,
    offerId: parsed.data.offerId ?? null,
    title: parsed.data.title,
    tokenHash: hash,
    expiresAt,
  }).returning();
  await db.insert(intakeSubmissions).values({ requestId: request.id });
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  return NextResponse.json({
    request,
    accessUrl: `${origin}/api/intakes/access?token=${encodeURIComponent(token)}`,
  }, { status: 201 });
}
