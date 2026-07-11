import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, campaigns, intakeRequests, intakeSubmissions, offers } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";
import type { IntakeAnswers } from "@/lib/intake/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const id = Number((await params).id);
  const db = getDb();
  const [campaign] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
  if (!campaign) return NextResponse.json({ error: "Campaña no encontrada" }, { status: 404 });
  const [offer] = await db.select().from(offers).where(eq(offers.id, campaign.offerId)).limit(1);
  const [brand] = offer ? await db.select().from(brands).where(eq(brands.id, offer.brandId)).limit(1) : [];
  const [request] = await db.select().from(intakeRequests).where(eq(intakeRequests.campaignId, campaign.id)).limit(1);
  const [submission] = request ? await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.requestId, request.id)).limit(1) : [];
  const latestSnapshot = submission?.submittedSnapshots.at(-1);
  const answers = ((latestSnapshot?.answers as Record<string, unknown> | undefined) ?? submission?.answers ?? {}) as IntakeAnswers;
  return NextResponse.json({
    title: campaign.title,
    producto: answers.offer?.description ?? offer?.name ?? "",
    audiencia: answers.audience?.primaryAvatar ?? "",
    oferta: [answers.offer?.price, answers.offer?.paymentOptions, answers.offer?.bonuses, answers.offer?.guarantee].filter(Boolean).join("\n"),
    dolores: answers.audience?.pains ?? "",
    objeciones: answers.audience?.objections ?? "",
    tono: answers.brand?.tone ?? String(brand?.profile?.tone ?? ""),
    cta: answers.campaign?.cta ?? "",
    duracionMin: answers.campaign?.durationMinutes ?? 10,
    instruccionesExtra: [answers.campaign?.angle && `Ángulo: ${answers.campaign.angle}`, answers.campaign?.mustInclude && `Incluir: ${answers.campaign.mustInclude}`, answers.campaign?.mustAvoid && `Evitar: ${answers.campaign.mustAvoid}`].filter(Boolean).join("\n"),
  });
}
