import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { clients, documents, scripts, scriptVersions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { guardAdminRequest } from "@/lib/auth/session";
import { getSetting } from "@/lib/settings";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  clientId: z.number().int().positive("Elegí un cliente"),
  title: z.string().trim().min(1).max(200).optional(),
});

/**
 * Crea un guion editable a partir de un documento de la biblioteca.
 *
 * Mismo patrón que `POST /api/templates/[id]/use`: el guion nace con el
 * provider y el modelo REALES de settings — no un placeholder — para que
 * Refinar, Crítica y Hook Lab funcionen sobre él desde el primer momento.
 */
export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const { id } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const db = getDb();
  const [document] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, Number(id)))
    .limit(1);
  if (!document) {
    return NextResponse.json({ error: "Documento no encontrado" }, { status: 404 });
  }
  if (!document.extractedText.trim()) {
    return NextResponse.json(
      { error: "El documento no tiene texto: no se puede usar como base." },
      { status: 400 }
    );
  }

  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.id, parsed.data.clientId))
    .limit(1);
  if (!client) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const model = (await getSetting("default_model_openrouter")) || "openrouter/ensemble-5+1";

  const created = await db.transaction(async (tx) => {
    const [script] = await tx
      .insert(scripts)
      .values({
        clientId: client.id,
        title: parsed.data.title ?? `${document.title} (adaptación)`,
        format: document.format ?? "vsl",
        provider: "openrouter",
        model,
        status: "draft",
        brief: {
          producto: "",
          audiencia: "",
          oferta: "",
          dolores: "",
          objeciones: "",
          duracionMin: 5,
          tono: "",
          cta: "",
          instruccionesExtra: `Adaptado del documento «${document.title}» de la biblioteca.`,
        },
      })
      .returning();

    const [version] = await tx
      .insert(scriptVersions)
      .values({
        scriptId: script.id,
        versionNumber: 1,
        content: document.extractedText,
        generationParams: { provider: "openrouter", model, documentIds: [document.id], frameworkId: null },
        source: "document",
      })
      .returning();

    return { scriptId: script.id, versionId: version.id };
  });

  return NextResponse.json(created, { status: 201 });
}
