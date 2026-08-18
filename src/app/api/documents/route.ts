import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { documents, DOCUMENT_KINDS, type DocumentKind } from "@/db/schema";
import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { extractText } from "@/lib/ingest/extract";
import { huellaContenido } from "@/lib/ingest/classify";
import { saveOriginal, safeFilename } from "@/lib/ingest/storage";
import { estimateTokens } from "@/lib/ai/tokens";
import { suggestedDocuments } from "@/lib/ai/context-builder";
import { guardAdminRequest } from "@/lib/auth/session";
import { industrySlug } from "@/lib/industry";

/**
 * Columnas del listado. NO incluye `extractedText` a propósito: el texto
 * completo de todo el corpus son megabytes por request, y el listado solo
 * necesita metadata. El texto se sirve en `GET /api/documents/[id]`.
 */
const COLUMNAS_LISTADO = {
  id: documents.id,
  clientId: documents.clientId,
  visibility: documents.visibility,
  industry: documents.industry,
  industrySlug: documents.industrySlug,
  format: documents.format,
  title: documents.title,
  kind: documents.kind,
  filename: documents.filename,
  tokenCount: documents.tokenCount,
  tags: documents.tags,
  isActive: documents.isActive,
  sourceScriptId: documents.sourceScriptId,
  createdAt: documents.createdAt,
};

/**
 * Traduce el parámetro `scope` a una condición.
 *   agencia            → doctrina global de la agencia
 *   industria:<slug>   → biblioteca de un vertical
 *   <clientId>         → documentos privados de un cliente
 *
 * `agencia` existe porque los documentos de vertical también tienen
 * `client_id = NULL`: sin distinguir por `visibility` se mezclaban con la
 * doctrina global y la tapaban en el listado.
 */
function condicionDeScope(scope: string): SQL | undefined {
  if (scope === "agencia") {
    return and(isNull(documents.clientId), eq(documents.visibility, "global"));
  }
  if (scope.startsWith("industria:")) {
    return and(
      eq(documents.visibility, "industry"),
      eq(documents.industrySlug, scope.slice("industria:".length))
    );
  }
  // Compatibilidad con el parámetro viejo: "global" = todo lo que no es de un cliente.
  if (scope === "global") return isNull(documents.clientId);
  const id = Number(scope);
  return Number.isFinite(id) ? eq(documents.clientId, id) : undefined;
}

export async function GET(req: NextRequest) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const sp = req.nextUrl.searchParams;
  const db = getDb();

  // Docs sugeridos para el wizard (cliente + ganadores globales + del vertical)
  const suggestedFor = sp.get("suggestedFor");
  if (suggestedFor) {
    return NextResponse.json(await suggestedDocuments(Number(suggestedFor)));
  }

  // Índice de la biblioteca: cuántos documentos hay en cada sección.
  if (sp.get("indice") === "1") {
    const [agencia] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(documents)
      .where(and(isNull(documents.clientId), eq(documents.visibility, "global")));
    const verticales = await db
      .select({
        slug: documents.industrySlug,
        industry: sql<string>`min(${documents.industry})`,
        n: sql<number>`count(*)::int`,
      })
      .from(documents)
      .where(and(eq(documents.visibility, "industry"), sql`${documents.industrySlug} is not null`))
      .groupBy(documents.industrySlug)
      .orderBy(documents.industrySlug);
    return NextResponse.json({ agencia: agencia?.n ?? 0, verticales });
  }

  const scope = sp.get("scope") ?? sp.get("clientId");
  const condiciones: Array<SQL | undefined> = [scope ? condicionDeScope(scope) : undefined];

  const q = sp.get("q")?.trim();
  if (q) {
    // El título alcanza para casi todo; `enTexto=1` busca dentro del guion.
    condiciones.push(
      sp.get("enTexto") === "1"
        ? or(ilike(documents.title, `%${q}%`), ilike(documents.extractedText, `%${q}%`))
        : ilike(documents.title, `%${q}%`)
    );
  }

  const kinds = sp.get("kind")?.split(",").filter(Boolean) as DocumentKind[] | undefined;
  if (kinds?.length) condiciones.push(inArray(documents.kind, kinds));

  const format = sp.get("format");
  if (format === "vsl" || format === "reel") condiciones.push(eq(documents.format, format));
  if (format === "agnostico") condiciones.push(isNull(documents.format));

  const activo = sp.get("activo");
  if (activo === "1") condiciones.push(eq(documents.isActive, true));
  if (activo === "0") condiciones.push(eq(documents.isActive, false));

  const filtros = condiciones.filter((c): c is SQL => c !== undefined);

  const rows = await db
    .select(COLUMNAS_LISTADO)
    .from(documents)
    .where(filtros.length ? and(...filtros) : undefined)
    .orderBy(desc(documents.createdAt));

  return NextResponse.json(rows);
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
