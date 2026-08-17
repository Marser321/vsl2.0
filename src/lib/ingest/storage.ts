import { randomUUID } from "node:crypto";
import { getSupabaseAdmin, INTAKE_BUCKET } from "@/lib/supabase";

/**
 * Guarda el original de un documento en el bucket privado y devuelve su path.
 * El filesystem de Vercel es efímero, así que el archivo tal como lo subió el
 * usuario solo sobrevive en Storage.
 *
 * Lo comparten el endpoint `POST /api/documents` y el importador masivo
 * (`scripts/import-corpus-dir.ts`) para que el layout del bucket sea uno solo.
 */
export async function saveOriginal(args: {
  documentId: number;
  buffer: Buffer;
  filename: string;
  mimeType: string | null;
}): Promise<string> {
  const filePath = `library/${args.documentId}/${randomUUID()}-${args.filename}`;
  const { error } = await getSupabaseAdmin()
    .storage.from(INTAKE_BUCKET)
    .upload(filePath, args.buffer, { contentType: args.mimeType ?? undefined, upsert: false });
  if (error) throw new Error(`No se pudo guardar el original: ${error.message}`);
  return filePath;
}

/** Normaliza un nombre de archivo a algo seguro para una clave de storage. */
export function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
