import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { documents, DOCUMENT_KINDS, type DocumentKind } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { extractText } from "@/lib/ingest/extract";
import { huellaContenido } from "@/lib/ingest/classify";
import { saveOriginal, safeFilename } from "@/lib/ingest/storage";
import { estimateTokens } from "@/lib/ai/tokens";
import { suggestedDocuments } from "@/lib/ai/context-builder";
import { guardAdminRequest } from "@/lib/auth/session";
import { industrySlug } from "@/lib/industry";

export async function GET(req: NextRequest) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const sp = req.nextUrl.searchParams;

  // Docs sugeridos para el wizard (cliente + ganadores globales)
  const suggestedFor = sp.get("suggestedFor");
  if (suggestedFor) {
    return NextResponse.json(await suggestedDocuments(Number(suggestedFor)));
  }

  const clientId = sp.get("clientId");
  const db = getDb();
  const rows =
    clientId === "global"
      ? db
          .select()
          .from(documents)
          .where(isNull(documents.clientId))
          .orderBy(desc(documents.createdAt))
      : clientId
        ? db
            .select()
            .from(documents)
            .where(eq(documents.clientId, Number(clientId)))
            .orderBy(desc(documents.createdAt))
        : db.select().from(documents).orderBy(desc(documents.createdAt));

  return NextResponse.json(await rows);
}

export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const form = await req.formData();
  const kind = form.get("kind") as DocumentKind | null;
  const clientIdRaw = form.get("clientId") as string | null;
  const clientId = clientIdRaw && clientIdRaw !== "global" ? Number(clientIdRaw) : null;

  if (!kind || !DOCUMENT_KINDS.includes(kind)) {
    return NextResponse.json({ error: "Tipo de documento inválido" }, { status: 400 });
  }

  const file = form.get("file") as File | null;
  const pastedText = (form.get("text") as string | null)?.trim() || "";
  const title = ((form.get("title") as string | null) || file?.name || "Sin título").trim();
  // Rubro opcional: sube el documento a la biblioteca del vertical en vez de a
  // la global, para que lo vean todos los clientes de esa industria.
  const industry = (form.get("industry") as string | null)?.trim() || null;
  const industrySlugValue = industrySlug(industry);

  let extractedText = pastedText;
  let warning: string | null = null;
  let filename: string | null = null;
  let mimeType: string | null = null;
  let filePath: string | null = null;
  let savedBuffer: Buffer | null = null;

  if (file) {
    const buffer = Buffer.from(await file.arrayBuffer());
    savedBuffer = buffer;
    filename = safeFilename(file.name);
    mimeType = file.type || "application/octet-stream";
    const result = await extractText(buffer, mimeType, filename);
    extractedText = result.text || pastedText;
    warning = result.warning;
  }

  if (!extractedText && !warning) {
    return NextResponse.json(
      { error: "Subí un archivo o pegá el texto del documento" },
      { status: 400 }
    );
  }

  const tokenCount = extractedText ? estimateTokens(extractedText) : 0;

  const db = getDb();
  const [row] = await db
    .insert(documents)
    .values({
      clientId,
      visibility: clientId !== null ? "private" : industrySlugValue ? "industry" : "global",
      industry,
      industrySlug: industrySlugValue,
      contentHash: extractedText ? huellaContenido(extractedText) : null,
      title,
      kind,
      filename,
      mimeType,
      filePath: null,
      extractedText,
      tokenCount,
      isActive: extractedText.length > 0,
    })
    .returning();

  // Guardar el original en el bucket privado; el filesystem de Vercel es efímero.
  if (savedBuffer && filename) {
    try {
      filePath = await saveOriginal({ documentId: row.id, buffer: savedBuffer, filename, mimeType });
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 502 });
    }
    await db.update(documents)
      .set({ filePath })
      .where(eq(documents.id, row.id));
  }

  return NextResponse.json({ ...row, filePath, warning }, { status: 201 });
}
