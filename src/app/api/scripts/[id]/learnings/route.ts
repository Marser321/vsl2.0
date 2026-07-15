import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, clients, industryLearnings, scriptRatings, scripts, scriptVersions } from "@/db/schema";
import { generateJSON } from "@/lib/ai/structured";
import { getSetting } from "@/lib/settings";
import { guardAdminRequest } from "@/lib/auth/session";
import { anonymizeLearning } from "@/lib/intake/anonymize";

export const maxDuration = 300;

const LEARNINGS_SCHEMA = {
  type: "object",
  properties: { aprendizajes: { type: "array", items: { type: "string" } } },
  required: ["aprendizajes"],
  additionalProperties: false,
};

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Params) {
  const guard = await guardAdminRequest(_req, true); if (guard) return guard;
  const { id } = await params;
  const body = await _req.json().catch(() => ({}));
  const fromRating = Boolean(body?.fromRating);
  const db = getDb();
  const [script] = await db.select().from(scripts).where(eq(scripts.id, Number(id))).limit(1);
  if (!script) return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });
  const versions = await db.select().from(scriptVersions).where(eq(scriptVersions.scriptId, script.id)).orderBy(asc(scriptVersions.versionNumber));
  const lastVersion = versions.at(-1);
  if (!lastVersion) return NextResponse.json({ error: "El guion no tiene versiones" }, { status: 400 });

  // Evidencia: resultado real (won/lost) o puntuación fuerte del equipo (≤2 o ≥4).
  const [rating] = await db.select().from(scriptRatings).where(eq(scriptRatings.scriptVersionId, lastVersion.id)).limit(1);
  const ratingDriven = fromRating && rating && (rating.score <= 2 || rating.score >= 4);
  if (script.outcome === "unknown" && !ratingDriven) {
    return NextResponse.json(
      { error: "Marcá primero el resultado del guion, o puntuá la última versión con ≤2 o ≥4 estrellas." },
      { status: 400 }
    );
  }

  const [client] = await db.select().from(clients).where(eq(clients.id, script.clientId)).limit(1);
  const [brand] = script.brandId ? await db.select().from(brands).where(eq(brands.id, script.brandId)).limit(1) : [];
  const industry = brand?.industry || client?.industry || "general";
  const subindustry = brand?.subindustry || null;
  const refinements = versions.filter((version) => version.refinementInstruction).map((version) => `- Ajuste: ${version.refinementInstruction}`).join("\n");

  const TAG_LABELS: Record<string, string> = { gancho: "gancho", claridad: "claridad", prueba: "prueba", oferta: "oferta", cta: "CTA", flujoEmocional: "flujo emocional", tono: "tono", largo: "largo/duración" };
  const evidencia = ratingDriven && rating
    ? `Puntuación del equipo: ${rating.score}/5.${rating.tags.length ? ` Factores marcados: ${rating.tags.map((t) => TAG_LABELS[t] ?? t).join(", ")}.` : ""}${rating.notes ? ` Notas del equipo: "${rating.notes}".` : ""}`
    : `Notas de resultado: ${script.outcomeNotes ?? "—"}`;
  const calificacion = script.outcome === "won"
    ? "ganador"
    : script.outcome === "lost"
      ? "que no convirtió"
      : rating && rating.score >= 4
        ? "muy bien puntuado por el equipo"
        : "mal puntuado por el equipo";
  const encargo = ratingDriven && rating && rating.score <= 2
    ? `Extraé 3 a 5 ANTI-PATRONES reutilizables de este guion ${calificacion}: reglas de qué EVITAR, empezando cada una con "Evitar".`
    : `Extraé 3 a 5 reglas reutilizables de este guion ${calificacion}.`;

  try {
    const result = await generateJSON<{ aprendizajes: string[] }>({
      systemBlocks: [{ text: await getSetting("system_prompt"), cache: true }],
      userMessage: `${encargo}\n\nRubro: ${industry}${subindustry ? ` / ${subindustry}` : ""}\n${evidencia}\nBrief sin identificar a la marca: audiencia ${script.brief.audiencia}; oferta ${script.brief.oferta}.\n${refinements}\n\nGuion:\n${lastVersion.content}\n\nNo incluyas nombres, URLs, precios, testimonios, cifras privadas ni frases que permitan identificar al cliente. Cada aprendizaje debe ser una regla general, accionable y respaldada por la evidencia observada.`,
      schema: LEARNINGS_SCHEMA,
    });
    const sanitized = result.aprendizajes.map(anonymizeLearning);
    const rows = await db.insert(industryLearnings).values(sanitized.map((content) => ({
      industry,
      subindustry,
      content,
      sourceScriptId: script.id,
      isActive: false,
    }))).returning();
    return NextResponse.json({ aprendizajes: sanitized, learningIds: rows.map((row) => row.id), pendingApproval: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
