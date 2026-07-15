import { randomUUID } from "node:crypto";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";
import { ANALYSIS_BUCKET, getSupabaseAdmin } from "@/lib/supabase";

const allowed = new Set([
  "audio/mpeg", "audio/mp4", "audio/x-m4a", "audio/wav", "audio/webm",
  "video/mp4", "video/webm",
]);
const uploadSchema = z.object({
  filename: z.string().trim().min(1).max(240),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().positive().max(100 * 1024 * 1024),
});

export async function POST(req: Request) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const parsed = uploadSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Archivo inválido o mayor a 100 MB." }, { status: 400 });
  if (!allowed.has(parsed.data.mimeType)) {
    return Response.json({ error: "Subí MP3, M4A, WAV, MP4 o WebM." }, { status: 400 });
  }
  const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
  const path = `analysis/${randomUUID()}/${safeName}`;
  const { data, error } = await getSupabaseAdmin().storage.from(ANALYSIS_BUCKET).createSignedUploadUrl(path);
  if (error) return Response.json({ error: error.message }, { status: 503 });
  return Response.json({ path, token: data.token, bucket: ANALYSIS_BUCKET }, { status: 201 });
}
