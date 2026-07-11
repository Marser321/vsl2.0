import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  brands,
  campaigns,
  clients,
  documents,
  intakeRequests,
  intakeSubmissions,
  offers,
  sourceAssets,
  type IntakeStatus,
  type JsonObject,
} from "@/db/schema";
import { assertSameOrigin, isAdminSession } from "@/lib/auth/session";
import type { IntakeAnswers } from "@/lib/intake/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const { id } = await params;
  const db = getDb();
  const [request] = await db.select().from(intakeRequests).where(eq(intakeRequests.id, id)).limit(1);
  if (!request) return NextResponse.json({ error: "Relevamiento no encontrado" }, { status: 404 });
  const [[submission], assets, [client], brandRows, offerRows] = await Promise.all([
    db.select().from(intakeSubmissions).where(eq(intakeSubmissions.requestId, request.id)).limit(1),
    db.select().from(sourceAssets).where(eq(sourceAssets.intakeRequestId, request.id)),
    request.clientId ? db.select().from(clients).where(eq(clients.id, request.clientId)).limit(1) : Promise.resolve([]),
    request.clientId ? db.select().from(brands).where(eq(brands.clientId, request.clientId)) : Promise.resolve([]),
    request.brandId ? db.select().from(offers).where(eq(offers.brandId, request.brandId)) : Promise.resolve([]),
  ]);
  return NextResponse.json({ request, submission, assets, client, brands: brandRows, offers: offerRows });
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start_review") }),
  z.object({ action: z.literal("request_changes") }),
  z.object({ action: z.literal("revoke") }),
  z.object({ action: z.literal("approve") }),
]);

const transitions: Record<string, { from: IntakeStatus[]; to: IntakeStatus }> = {
  start_review: { from: ["submitted"], to: "in_review" },
  request_changes: { from: ["in_review"], to: "changes_requested" },
  revoke: { from: ["draft", "submitted", "in_review", "changes_requested"], to: "revoked" },
};

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdminSession())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  assertSameOrigin(req);
  const { id } = await params;
  const parsed = actionSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
  const db = getDb();
  const [request] = await db.select().from(intakeRequests).where(eq(intakeRequests.id, id)).limit(1);
  if (!request) return NextResponse.json({ error: "Relevamiento no encontrado" }, { status: 404 });

  if (parsed.data.action === "approve") return approveIntake(request.id, request.status);
  const transition = transitions[parsed.data.action];
  if (!transition.from.includes(request.status)) return NextResponse.json({ error: `No se puede ejecutar esa acción desde ${request.status}.` }, { status: 409 });
  const now = new Date();
  const [updated] = await db.update(intakeRequests).set({
    status: transition.to,
    updatedAt: now,
    ...(parsed.data.action === "start_review" ? { reviewStartedAt: now } : {}),
    ...(parsed.data.action === "request_changes" ? { expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), reviewStartedAt: null } : {}),
    ...(parsed.data.action === "revoke" ? { revokedAt: now } : {}),
  }).where(eq(intakeRequests.id, id)).returning();
  return NextResponse.json(updated);
}

async function approveIntake(requestId: string, currentStatus: IntakeStatus) {
  if (currentStatus !== "in_review") return NextResponse.json({ error: "Solo se aprueba un relevamiento en revisión." }, { status: 409 });
  const db = getDb();
  const [request] = await db.select().from(intakeRequests).where(eq(intakeRequests.id, requestId)).limit(1);
  const [submission] = await db.select().from(intakeSubmissions).where(eq(intakeSubmissions.requestId, requestId)).limit(1);
  if (!request?.clientId || !submission) return NextResponse.json({ error: "Faltan cliente o respuestas." }, { status: 400 });
  const latestSnapshot = submission.submittedSnapshots.at(-1);
  const answers = ((latestSnapshot?.answers as JsonObject | undefined) ?? submission.answers) as IntakeAnswers;
  if (!answers.brand || !answers.offer || !answers.campaign) return NextResponse.json({ error: "El dossier está incompleto." }, { status: 400 });
  const brandAnswers = answers.brand;
  const offerAnswers = answers.offer;
  const campaignAnswers = answers.campaign;
  const clientId = request.clientId;

  return db.transaction(async (tx) => {
    const [lock] = await tx.update(intakeRequests).set({
      status: "approved",
      approvedAt: new Date(),
      updatedAt: new Date(),
    }).where(and(eq(intakeRequests.id, requestId), eq(intakeRequests.status, "in_review"))).returning();
    if (!lock) return NextResponse.json({ error: "El relevamiento ya fue procesado por otra sesión." }, { status: 409 });

    let brandId = request.brandId;
    const brandProfile = brandAnswers as unknown as JsonObject;
    if (brandId) {
      await tx.update(brands).set({
        name: brandAnswers.name,
        website: brandAnswers.website || null,
        industry: brandAnswers.industry,
        subindustry: brandAnswers.subindustry || null,
        profile: brandProfile,
        updatedAt: new Date(),
      }).where(and(eq(brands.id, brandId), eq(brands.clientId, clientId)));
    } else {
      const [brand] = await tx.insert(brands).values({
        clientId,
        name: brandAnswers.name,
        website: brandAnswers.website || null,
        industry: brandAnswers.industry,
        subindustry: brandAnswers.subindustry || null,
        profile: brandProfile,
      }).returning();
      brandId = brand.id;
    }

    let offerId = request.offerId;
    const offerProfile = offerAnswers as unknown as JsonObject;
    if (offerId) {
      await tx.update(offers).set({ name: offerAnswers.name, type: offerAnswers.type, profile: offerProfile, updatedAt: new Date() }).where(and(eq(offers.id, offerId), eq(offers.brandId, brandId!)));
    } else {
      const [offer] = await tx.insert(offers).values({ brandId: brandId!, name: offerAnswers.name, type: offerAnswers.type, profile: offerProfile }).returning();
      offerId = offer.id;
    }

    const [campaign] = await tx.insert(campaigns).values({
      offerId: offerId!,
      title: campaignAnswers.title,
      objective: campaignAnswers.objective,
      brief: campaignAnswers as unknown as JsonObject,
    }).returning();

    const assets = await tx.select().from(sourceAssets).where(and(eq(sourceAssets.intakeRequestId, requestId), eq(sourceAssets.status, "ready")));
    if (assets.length) {
      await tx.insert(documents).values(assets.map((asset) => ({
        clientId,
        brandId,
        offerId,
        campaignId: campaign.id,
        intakeRequestId: requestId,
        sourceAssetId: asset.id,
        visibility: "private" as const,
        industry: brandAnswers.industry,
        title: asset.title,
        kind: asset.kind === "text" ? "brief" as const : asset.kind === "video_url" ? "transcript" as const : "reference" as const,
        filename: asset.storagePath?.split("/").pop() ?? null,
        mimeType: asset.mimeType,
        filePath: asset.storagePath,
        extractedText: asset.extractedText,
        tokenCount: Math.ceil(asset.extractedText.length / 4),
        tags: ["relevamiento", asset.kind],
      })));
    }

    const [updated] = await tx.update(intakeRequests).set({
      brandId,
      offerId,
      campaignId: campaign.id,
      status: "approved",
      updatedAt: new Date(),
    }).where(eq(intakeRequests.id, requestId)).returning();
    return NextResponse.json({ request: updated, brandId, offerId, campaignId: campaign.id });
  });
}
