/**
 * Backfill one-shot de las columnas normalizadas que agregó la migración 0008.
 *
 * - `documents.industry_slug` y `industry_learnings.industry_slug` /
 *   `subindustry_slug`: se calculan con `industrySlug()` en TS para que la
 *   lógica de alias viva en un solo lugar y no se duplique en SQL.
 * - `documents.format`: los documentos del corpus fundacional que son
 *   claramente de un formato quedan marcados, para que el filtro por formato
 *   del Bloque 1 no meta doctrina de VSL largo en un reel. Solo toca filas con
 *   tag `corpus:<slug>` — nunca pisa lo que el usuario cargó a mano.
 *
 * Idempotente: correrlo dos veces no cambia nada.
 *
 * Uso: npm run db:backfill-slugs [-- --dry-run]
 */
import { eq, sql } from "drizzle-orm";
import { getDb } from "../src/db";
import { documents, industryLearnings, type ScriptFormat } from "../src/db/schema";
import { industrySlug } from "../src/lib/industry";

/**
 * Formato de los documentos del corpus fundacional (`src/db/seed-corpus.ts`).
 * Lo que no está acá es agnóstico a propósito: la ecuación de valor, la
 * taxonomía de ganchos, las objeciones y los niveles de conciencia aplican
 * igual a un VSL de 10 minutos que a un reel de 20 segundos.
 */
const CORPUS_FORMATS: Record<string, ScriptFormat> = {
  "vsl-clasico-doctrina": "vsl",
  "reglas-oro-vsl": "vsl",
  "desglose-vsl-highticket": "vsl",
  "desglose-vsl-corto-dtc": "vsl",
  "mensaje-4-partes": "vsl",
  "playbook-reels": "reel",
  "desglose-reel-conversion": "reel",
};

const dryRun = process.argv.includes("--dry-run");

async function backfill() {
  const db = getDb();
  const prefix = dryRun ? "[dry-run] " : "";

  // ── documents.industry_slug ───────────────────────────────────────────────
  const docsConRubro = await db
    .select({ id: documents.id, industry: documents.industry, industrySlug: documents.industrySlug })
    .from(documents)
    .where(sql`${documents.industry} is not null and ${documents.industry} <> ''`);

  const fusiones = new Map<string, string[]>();
  let docsActualizados = 0;
  for (const doc of docsConRubro) {
    const slug = industrySlug(doc.industry);
    if (!slug || slug === doc.industrySlug) continue;
    fusiones.set(slug, [...(fusiones.get(slug) ?? []), doc.industry!]);
    if (!dryRun) {
      await db.update(documents).set({ industrySlug: slug }).where(eq(documents.id, doc.id));
    }
    docsActualizados++;
  }

  if (fusiones.size > 0) {
    console.log("\nRubros de documentos que se agrupan bajo un mismo slug:");
    for (const [slug, originales] of fusiones) {
      const variantes = [...new Set(originales)];
      console.log(`  ${slug} ← ${variantes.map((v) => `"${v}"`).join(", ")}`);
    }
  }

  // ── industry_learnings.industry_slug / subindustry_slug ───────────────────
  const learnings = await db
    .select({
      id: industryLearnings.id,
      industry: industryLearnings.industry,
      subindustry: industryLearnings.subindustry,
      industrySlug: industryLearnings.industrySlug,
    })
    .from(industryLearnings);

  let learningsActualizados = 0;
  for (const learning of learnings) {
    const slug = industrySlug(learning.industry);
    if (!slug || slug === learning.industrySlug) continue;
    if (!dryRun) {
      await db
        .update(industryLearnings)
        .set({ industrySlug: slug, subindustrySlug: industrySlug(learning.subindustry) })
        .where(eq(industryLearnings.id, learning.id));
    }
    learningsActualizados++;
  }

  // ── documents.format del corpus fundacional ───────────────────────────────
  let formatosMarcados = 0;
  for (const [slug, format] of Object.entries(CORPUS_FORMATS)) {
    const tag = `corpus:${slug}`;
    if (!dryRun) {
      const filas = await db
        .update(documents)
        .set({ format })
        .where(sql`${documents.tags} ? ${tag} and ${documents.format} is distinct from ${format}`)
        .returning({ id: documents.id });
      formatosMarcados += filas.length;
    } else {
      const filas = await db
        .select({ id: documents.id })
        .from(documents)
        .where(sql`${documents.tags} ? ${tag} and ${documents.format} is distinct from ${format}`);
      formatosMarcados += filas.length;
    }
  }

  console.log(
    `\n${prefix}Backfill OK: ${docsActualizados} documentos con slug de rubro, ` +
      `${learningsActualizados} aprendizajes normalizados, ${formatosMarcados} documentos del corpus marcados por formato.`
  );
  if (dryRun) console.log("Nada se escribió. Corré sin --dry-run para aplicar.");
}

backfill().then(
  () => process.exit(0),
  (error) => {
    console.error("Backfill falló:", error);
    process.exit(1);
  }
);
