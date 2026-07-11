import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { sourceAssets } from "@/db/schema";
import { assertSameOrigin } from "@/lib/auth/session";
import { publicIntakeError, requirePublicIntake } from "@/lib/intake/access";
import { processAsset } from "@/lib/ingest/asset";

type Params = { params: Promise<{ publicId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const request = await requirePublicIntake((await params).publicId);
    return NextResponse.json(await getDb().select().from(sourceAssets).where(eq(sourceAssets.intakeRequestId, request.id)));
  } catch (error) { return publicIntakeError(error); }
}

const createSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), title: z.string().trim().min(1).max(240), text: z.string().trim().min(1).max(200_000) }),
  z.object({ kind: z.enum(["url", "video_url"]), title: z.string().trim().min(1).max(240), url: z.url().max(4_000) }),
]);

export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(req);
    const request = await requirePublicIntake((await params).publicId);
    if (!["draft", "changes_requested"].includes(request.status)) return NextResponse.json({ error: "El relevamiento está bloqueado." }, { status: 423 });
    const parsed = createSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
    const [asset] = await getDb().insert(sourceAssets).values({
      intakeRequestId: request.id,
      kind: parsed.data.kind,
      title: parsed.data.title,
      sourceUrl: parsed.data.kind === "text" ? null : parsed.data.url,
      extractedText: parsed.data.kind === "text" ? parsed.data.text : "",
    }).returning();
    const result = await processAsset(asset.id);
    return NextResponse.json({ ...asset, ...result }, { status: 201 });
  } catch (error) { return publicIntakeError(error); }
}
