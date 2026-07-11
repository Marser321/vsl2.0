import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sourceAssets } from "@/db/schema";
import { assertSameOrigin } from "@/lib/auth/session";
import { publicIntakeError, requirePublicIntake } from "@/lib/intake/access";
import { processAsset } from "@/lib/ingest/asset";

type Params = { params: Promise<{ publicId: string; assetId: string }> };
export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(req);
    const { publicId, assetId } = await params;
    const request = await requirePublicIntake(publicId);
    if (!["draft", "changes_requested"].includes(request.status)) return NextResponse.json({ error: "El relevamiento está bloqueado." }, { status: 423 });
    const [asset] = await getDb().select().from(sourceAssets).where(and(eq(sourceAssets.id, assetId), eq(sourceAssets.intakeRequestId, request.id))).limit(1);
    if (!asset) return NextResponse.json({ error: "Archivo no encontrado." }, { status: 404 });
    return NextResponse.json(await processAsset(asset.id));
  } catch (error) { return publicIntakeError(error); }
}
