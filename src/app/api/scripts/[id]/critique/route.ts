import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { critiques, scripts, scriptVersions } from "@/db/schema";
import type { CritiqueData } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { buildContext } from "@/lib/ai/context-builder";
import { generateJSON } from "@/lib/ai/structured";
import { guardAdminRequest } from "@/lib/auth/session";

export const maxDuration = 60;

const scoreDef = { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] };
const commentDef = { type: "string" };

const CRITIQUE_SCHEMA = {
  type: "object",
  properties: {
    puntajes: {
      type: "object",
      properties: {
        gancho: scoreDef,
        claridad: scoreDef,
        prueba: scoreDef,
        oferta: scoreDef,
        cta: scoreDef,
        flujoEmocional: scoreDef,
      },
      required: ["gancho", "claridad", "prueba", "oferta", "cta", "flujoEmocional"],
      additionalProperties: false,
    },
    comentarios: {
      type: "object",
      properties: {
        gancho: commentDef,
        claridad: commentDef,
        prueba: commentDef,
        oferta: commentDef,
        cta: commentDef,
        flujoEmocional: commentDef,
      },
      required: ["gancho", "claridad", "prueba", "oferta", "cta", "flujoEmocional"],
      additionalProperties: false,
    },
    edicionesSugeridas: {
      type: "array",
      items: { type: "string" },
    },
    veredicto: { type: "string" },
  },
  required: ["puntajes", "comentarios", "edicionesSugeridas", "veredicto"],
  additionalProperties: false,
};

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(); if (guard) return guard;
  const { id } = await params;
  const versionId = req.nextUrl.searchParams.get("versionId");
  const db = getDb();
  const [script] = await db.select().from(scripts).where(eq(scripts.id, Number(id))).limit(1);
  if (!script)
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const rows = versionId
    ? await db
        .select()
        .from(critiques)
        .where(eq(critiques.scriptVersionId, Number(versionId)))
        .orderBy(desc(critiques.createdAt))
    : [];
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(req, true); if (guard) return guard;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const db = getDb();
  const [script] = await db.select().from(scripts).where(eq(scripts.id, Number(id))).limit(1);
  if (!script)
    return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });

  const version = body.versionId
    ? (await db
        .select()
        .from(scriptVersions)
        .where(eq(scriptVersions.id, Number(body.versionId)))
        .limit(1))[0]
    : (await db
        .select()
        .from(scriptVersions)
        .where(eq(scriptVersions.scriptId, script.id))
        .orderBy(desc(scriptVersions.versionNumber))
        .limit(1))[0];
  if (!version)
    return NextResponse.json({ error: "Versión no encontrada" }, { status: 404 });

  const context = await buildContext({
    clientId: script.clientId,
    brandId: script.brandId,
    offerId: script.offerId,
    campaignId: script.campaignId,
    frameworkId: script.frameworkId,
    documentIds: version.generationParams.documentIds,
    brief: script.brief,
  });

  try {
    const data = await generateJSON<CritiqueData>({
      systemBlocks: context.systemBlocks,
      userMessage: `Cambiá de rol: ahora sos el COPY CHIEF que revisa este guion antes de entregarlo al cliente. Evaluá con vara alta — un 8+ significa "saldría al aire así".

Guion a evaluar:

${version.content}

Rúbrica (1-10 por dimensión):
- **gancho**: ¿los primeros 30 segundos obligan a seguir mirando?
- **claridad**: ¿un espectador distraído entiende qué es y para quién?
- **prueba**: ¿los claims están respaldados (testimonios, datos, mecanismo creíble)?
- **oferta**: ¿la oferta se percibe irresistible y sin fricción?
- **cta**: ¿el llamado a la acción es específico, motivado y sin ambigüedad?
- **flujoEmocional**: ¿la progresión emocional sostiene la atención de punta a punta?

Para cada dimensión, un comentario concreto (qué está bien / qué falta). En edicionesSugeridas, las 3-6 ediciones puntuales de mayor impacto (citá la frase a cambiar cuando aplique). En veredicto, 2-3 frases de resumen ejecutivo.`,
      schema: CRITIQUE_SCHEMA,
    });

    const [row] = await db
      .insert(critiques)
      .values({ scriptVersionId: version.id, data })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
