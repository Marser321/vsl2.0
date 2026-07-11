import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assetExtractions, sourceAssets, type AssetStatus } from "@/db/schema";
import { extractText } from "./extract";
import { extractPublicUrl } from "./url";
import { analyzeBinaryAsset } from "./vision";
import { getSupabaseAdmin, INTAKE_BUCKET } from "@/lib/supabase";

export async function processAsset(assetId: string) {
  const db = getDb();
  const [asset] = await db.select().from(sourceAssets).where(eq(sourceAssets.id, assetId)).limit(1);
  if (!asset) throw new Error("Asset no encontrado.");
  await db.update(sourceAssets).set({ status: "processing", error: null, updatedAt: new Date() }).where(eq(sourceAssets.id, asset.id));

  let status: AssetStatus = "ready";
  let text = "";
  let provider: string | null = null;
  let model: string | null = null;
  let metadata: Record<string, unknown> = {};
  let error: string | null = null;
  try {
    if (asset.kind === "text") {
      text = asset.extractedText;
    } else if (asset.kind === "url" || asset.kind === "video_url") {
      if (!asset.sourceUrl) throw new Error("Falta la URL.");
      const result = await extractPublicUrl(asset.sourceUrl);
      text = result.text;
      metadata = { ...result.metadata, finalUrl: result.finalUrl, contentType: result.contentType };
      status = result.needsInput ? "needs_input" : "ready";
      if (result.needsInput) error = "No se encontró un transcript público. Pegalo o adjuntalo para sumar ese contenido.";
    } else {
      if (!asset.storagePath || !asset.mimeType) throw new Error("El archivo todavía no fue subido.");
      const { data, error: downloadError } = await getSupabaseAdmin().storage.from(INTAKE_BUCKET).download(asset.storagePath);
      if (downloadError || !data) throw new Error(downloadError?.message ?? "No se pudo descargar el archivo.");
      const buffer = Buffer.from(await data.arrayBuffer());
      if (asset.mimeType.startsWith("image/")) {
        const result = await analyzeBinaryAsset(buffer, asset.mimeType, asset.title);
        text = result.text; provider = result.provider; model = result.model;
      } else {
        const result = await extractText(buffer, asset.mimeType, asset.title);
        text = result.text;
        if (!text && result.warning) {
          if (asset.mimeType === "application/pdf") {
            const vision = await analyzeBinaryAsset(buffer, asset.mimeType, asset.title);
            text = vision.text; provider = vision.provider; model = vision.model;
          } else {
            status = "needs_input";
            error = result.warning;
          }
        }
      }
    }
  } catch (caught) {
    status = "failed";
    error = (caught as Error).message;
  }

  await db.transaction(async (tx) => {
    await tx.update(sourceAssets).set({ status, extractedText: text, extractionMetadata: metadata, error, updatedAt: new Date() }).where(eq(sourceAssets.id, asset.id));
    await tx.insert(assetExtractions).values({ assetId: asset.id, provider, model, status, text, metadata, error });
  });
  return { status, text, metadata, error };
}
