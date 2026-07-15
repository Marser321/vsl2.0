import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/db";
import { documents, frameworks, scriptRatings, scripts, scriptVersions } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { generateJSON } from "@/lib/ai/structured";
import { countTokens } from "@/lib/ai/anthropic";
import { getSetting } from "@/lib/settings";
import { guardAdminRequest } from "@/lib/auth/session";

export const maxDuration = 300;

const PREFS_TAG = "auto-preferencias";
const PREFS_TITLE = "[AUTO] Preferencias aprendidas del equipo";
const MIN_RATINGS = 5;

const PREFS_SCHEMA = {
  type: "object",
  properties: {
    reglas: { type: "array", items: { type: "string" } },
    antipatrones: { type: "array", items: { type: "string" } },
    notasDeTono: { type: "array", items: { type: "string" } },
  },
  required: ["reglas", "antipatrones", "notasDeTono"],
  additionalProperties: false,
} as const;

type Db = ReturnType<typeof getDb>;

async function findPrefsDoc(db: Db) {
  const globals = await db
    .select()
    .from(documents)
    .where(and(isNull(documents.clientId), eq(documents.visibility, "global")));
  return globals.find((d) => d.tags.includes(PREFS_TAG)) ?? null;
}

export async function GET() {
  const guard = await guardAdminRequest();
  if (guard) return guard;
  const db = getDb();
  const doc = await findPrefsDoc(db);
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(scriptRatings);
  return NextResponse.json({ doc, totalRatings: Number(row?.n ?? 0), minRatings: MIN_RATINGS });
}

/**
 * Regenera el documento global "[AUTO] Preferencias aprendidas del equipo" a
 * partir de las puntuaciones. Entra al Bloque 1 cacheado: regenerarlo invalida
 * el caché de prompt una vez (por eso es manual y deliberado).
 */
export async function POST(req: NextRequest) {
  const guard = await guardAdminRequest(req, true);
  if (guard) return guard;
  const db = getDb();

  const rated = await db
    .select({
      score: scriptRatings.score,
      tags: scriptRatings.tags,
      notes: scriptRatings.notes,
      format: scripts.format,
      brief: scripts.brief,
      frameworkName: frameworks.name,
    })
    .from(scriptRatings)
    .innerJoin(scriptVersions, eq(scriptRatings.scriptVersionId, scriptVersions.id))
    .innerJoin(scripts, eq(scriptVersions.scriptId, scripts.id))
    .leftJoin(frameworks, eq(scripts.frameworkId, frameworks.id))
    .orderBy(desc(scriptRatings.updatedAt));

  if (rated.length < MIN_RATINGS) {
    return NextResponse.json(
      { error: `Se necesitan al menos ${MIN_RATINGS} puntuaciones (hay ${rated.length}).` },
      { status: 400 }
    );
  }

  const top = rated.filter((r) => r.score >= 4).slice(0, 30);
  const bottom = rated.filter((r) => r.score <= 2).slice(0, 30);

  const tagFreq = (rows: typeof rated) => {
    const freq = new Map<string, number>();
    for (const r of rows) for (const t of r.tags) freq.set(t, (freq.get(t) ?? 0) + 1);
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `${t} (${n})`)
      .join(", ");
  };

  const line = (r: (typeof rated)[number]) =>
    `- [${r.score}/5] ${r.format} · ${r.frameworkName ?? "estructura libre"} · tono "${r.brief?.tono || "—"}"` +
    (r.tags.length ? ` · factores: ${r.tags.join(", ")}` : "") +
    (r.notes ? ` · notas: "${r.notes}"` : "");

  const userMessage = `Sintetizá las preferencias de calidad del equipo de la agencia a partir de sus puntuaciones a guiones generados.

## Versiones BIEN puntuadas (4-5★) — ${top.length}
${top.map(line).join("\n") || "- (ninguna)"}

## Versiones MAL puntuadas (1-2★) — ${bottom.length}
${bottom.map(line).join("\n") || "- (ninguna)"}

## Frecuencia de factores marcados
- En puntuaciones altas: ${tagFreq(top) || "—"}
- En puntuaciones bajas: ${tagFreq(bottom) || "—"}

Devolvé:
- "reglas": 3-7 reglas accionables de escritura que expliquen QUÉ hace que el equipo puntúe alto (generales, no atadas a un cliente).
- "antipatrones": 3-7 cosas concretas a EVITAR según las puntuaciones bajas (empezá cada una con "Evitar").
- "notasDeTono": 1-4 observaciones sobre el tono que el equipo prefiere.
Cada ítem: una sola frase, específica y verificable al leer un guion. Nada genérico tipo "escribir bien".`;

  try {
    const result = await generateJSON<{
      reglas: string[];
      antipatrones: string[];
      notasDeTono: string[];
    }>({
      systemBlocks: [{ text: await getSetting("system_prompt"), cache: true }],
      userMessage,
      schema: PREFS_SCHEMA as unknown as Record<string, unknown>,
    });

    const fecha = new Date().toISOString().slice(0, 10);
    const md = `_Generado automáticamente el ${fecha} a partir de ${rated.length} puntuaciones del equipo (${top.length} altas, ${bottom.length} bajas). Regenerable desde Aprendizajes._

## Reglas que aplicar siempre
${result.reglas.map((r) => `- ${r}`).join("\n")}

## Anti-patrones que evitar
${result.antipatrones.map((r) => `- ${r}`).join("\n")}

## Notas de tono
${result.notasDeTono.map((r) => `- ${r}`).join("\n")}`;

    const model = await getSetting("default_model_anthropic", "claude-opus-4-8");
    const tokenCount = await countTokens(md, model);

    // Reemplazo total: el doc es 100% derivado, se borra y re-crea.
    const existing = await findPrefsDoc(db);
    if (existing) await db.delete(documents).where(eq(documents.id, existing.id));
    const [doc] = await db
      .insert(documents)
      .values({
        clientId: null,
        visibility: "global",
        title: PREFS_TITLE,
        kind: "learning",
        extractedText: md,
        tokenCount,
        language: "es",
        tags: [PREFS_TAG, "auto"],
        isActive: true,
      })
      .returning();

    return NextResponse.json({ doc, basedOn: rated.length }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
