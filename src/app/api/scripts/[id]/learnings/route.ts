import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { brands, clients, industryLearnings, scripts, scriptVersions } from "@/db/schema";
import { generateJSON } from "@/lib/ai/structured";
import { getSetting } from "@/lib/settings";
import { guardAdminRequest } from "@/lib/auth/session";
import { anonymizeLearning } from "@/lib/intake/anonymize";

export const maxDuration = 60;

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
  const db = getDb();
  const [script] = await db.select().from(scripts).where(eq(scripts.id, Number(id))).limit(1);
  if (!script) return NextResponse.json({ error: "Guion no encontrado" }, { status: 404 });
  if (script.outcome === "unknown") return NextResponse.json({ error: "Marcá primero el resultado del guion." }, { status: 400 });
  const versions = await db.select().from(scriptVersions).where(eq(scriptVersions.scriptId, script.id)).orderBy(asc(scriptVersions.versionNumber));
  const lastVersion = versions.at(-1);
  if (!lastVersion) return NextResponse.json({ error: "El guion no tiene versiones" }, { status: 400 });
  const [client] = await db.select().from(clients).where(eq(clients.id, script.clientId)).limit(1);
  const [brand] = script.brandId ? await db.select().from(brands).where(eq(brands.id, script.brandId)).limit(1) : [];
  const industry = brand?.industry || client?.industry || "general";
  const subindustry = brand?.subindustry || null;
  const refinements = versions.filter((version) => version.refinementInstruction).map((version) => `- Ajuste: ${version.refinementInstruction}`).join("\n");

  try {
    const result = await generateJSON<{ aprendizajes: string[] }>({
      systemBlocks: [{ text: await getSetting("system_prompt"), cache: true }],
      userMessage: `Extraé 3 a 5 reglas reutilizables de este guion ${script.outcome === "won" ? "ganador" : "que no convirtió"}.\n\nRubro: ${industry}${subindustry ? ` / ${subindustry}` : ""}\nNotas de resultado: ${script.outcomeNotes ?? "—"}\nBrief sin identificar a la marca: audiencia ${script.brief.audiencia}; oferta ${script.brief.oferta}.\n${refinements}\n\nGuion:\n${lastVersion.content}\n\nNo incluyas nombres, URLs, precios, testimonios, cifras privadas ni frases que permitan identificar al cliente. Cada aprendizaje debe ser una regla general, accionable y respaldada por el resultado observado.`,
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
