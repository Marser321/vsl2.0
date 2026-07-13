import { desc, eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { getDb } from "@/db";
import { brands, campaigns, intakeRequests, offers } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest();
  if (guard) return guard;
  const clientId = Number((await params).id);
  if (!Number.isInteger(clientId) || clientId < 1) {
    return Response.json({ error: "Cliente inválido" }, { status: 400 });
  }

  const db = getDb();
  const campaignRows = await db
    .select({
      campaignId: campaigns.id,
      campaignTitle: campaigns.title,
      campaignObjective: campaigns.objective,
      offerId: offers.id,
      offerName: offers.name,
      brandId: brands.id,
      brandName: brands.name,
      createdAt: campaigns.createdAt,
    })
    .from(campaigns)
    .innerJoin(offers, eq(campaigns.offerId, offers.id))
    .innerJoin(brands, eq(offers.brandId, brands.id))
    .where(eq(brands.clientId, clientId))
    .orderBy(desc(campaigns.createdAt));
  const intakeRows = await db
    .select({ id: intakeRequests.id, title: intakeRequests.title, status: intakeRequests.status })
    .from(intakeRequests)
    .where(eq(intakeRequests.clientId, clientId))
    .orderBy(desc(intakeRequests.createdAt));

  return Response.json({ campaigns: campaignRows, latestIntake: intakeRows[0] ?? null });
}
