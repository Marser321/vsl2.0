import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/db";
import { sourceAssets } from "@/db/schema";
import { assertSameOrigin } from "@/lib/auth/session";
import { publicIntakeError, requirePublicIntake } from "@/lib/intake/access";
import { getSupabaseAdmin, INTAKE_BUCKET } from "@/lib/supabase";

type Params = { params: Promise<{ publicId: string }> };
const allowed = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain", "text/markdown"]);
const schema = z.object({ filename: z.string().trim().min(1).max(240), mimeType: z.string().min(1), sizeBytes: z.number().int().positive() });

export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertSameOrigin(req);
    const request = await requirePublicIntake((await params).publicId);
    if (!["draft", "changes_requested"].includes(request.status)) return NextResponse.json({ error: "El relevamiento está bloqueado." }, { status: 423 });
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || !allowed.has(parsed.data?.mimeType)) return NextResponse.json({ error: "Tipo de archivo no permitido." }, { status: 400 });
    const max = parsed.data.mimeType.startsWith("image/") ? 10 * 1024 * 1024 : 25 * 1024 * 1024;
    if (parsed.data.sizeBytes > max) return NextResponse.json({ error: `El archivo supera ${max / 1024 / 1024} MB.` }, { status: 413 });
    const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-160);
    const path = `${request.id}/${randomUUID()}/${safeName}`;
    const { data, error } = await getSupabaseAdmin().storage.from(INTAKE_BUCKET).createSignedUploadUrl(path);
    if (error) throw new Error(error.message);
    const [asset] = await getDb().insert(sourceAssets).values({
      intakeRequestId: request.id,
      kind: parsed.data.mimeType.startsWith("image/") ? "image" : "document",
      title: parsed.data.filename,
      storagePath: path,
      mimeType: parsed.data.mimeType,
      sizeBytes: parsed.data.sizeBytes,
    }).returning();
    return NextResponse.json({ asset, path, token: data.token }, { status: 201 });
  } catch (error) { return publicIntakeError(error); }
}
