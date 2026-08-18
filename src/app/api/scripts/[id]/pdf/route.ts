import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, scripts, scriptVersions } from "@/db/schema";
import { guardAdminRequest } from "@/lib/auth/session";
import { GuionPdf } from "@/lib/pdf/GuionPdf";

type Params = { params: Promise<{ id: string }> };

/** Nombre de archivo seguro y reconocible: "reel-el-puntaje-no-sube-v2.pdf". */
function nombreArchivo(titulo: string, version: number): string {
  const base = titulo
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "guion"}-v${version}.pdf`;
}

/**
 * Exporta un guion como PDF con la identidad de AD Media Solution.
 *
 * `?version=N` exporta una versión puntual; sin el parámetro sale la última,
 * que es lo que se quiere al mandarle el guion al cliente.
 */
export async function GET(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const { id } = await params;
  const db = getDb();

  const [script] = await db
    .select()
    .from(scripts)
    .where(eq(scripts.id, Number(id)))
    .limit(1);
  if (!script) {
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });
  }

  const pedida = Number(req.nextUrl.searchParams.get("version"));
  const [version] = Number.isFinite(pedida) && pedida > 0
    ? await db
        .select()
        .from(scriptVersions)
        .where(eq(scriptVersions.scriptId, script.id))
        .orderBy(asc(scriptVersions.versionNumber))
        .then((rows) => rows.filter((v) => v.versionNumber === pedida))
    : await db
        .select()
        .from(scriptVersions)
        .where(eq(scriptVersions.scriptId, script.id))
        .orderBy(desc(scriptVersions.versionNumber))
        .limit(1);

  if (!version || !version.content.trim()) {
    return NextResponse.json(
      { error: "El guion todavía no tiene contenido para exportar." },
      { status: 400 }
    );
  }

  const [cliente] = await db
    .select({ name: clients.name })
    .from(clients)
    .where(eq(clients.id, script.clientId))
    .limit(1);

  // La portada resume el encargo con lo que ya trae el brief.
  const descripcion = [script.brief.producto, script.brief.audiencia]
    .filter(Boolean)
    .join(" · ") || null;

  const buffer = await renderToBuffer(
    GuionPdf({
      datos: {
        titulo: script.title,
        cliente: cliente?.name ?? null,
        formato: script.format,
        contenido: version.content,
        version: version.versionNumber,
        descripcion,
        fecha: script.createdAt,
      },
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo(script.title, version.versionNumber)}"`,
      "Cache-Control": "no-store",
    },
  });
}
