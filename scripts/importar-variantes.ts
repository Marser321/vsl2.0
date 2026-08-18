/**
 * Carga las variantes de guion escritas a mano como guiones del sistema.
 *
 * Entran como `scripts` (no como documentos de biblioteca) para que se puedan
 * editar, puntuar, refinar, leer en teleprompter y exportar a PDF igual que
 * cualquier guion generado. Nacen en `draft` y con `source: "manual"`, que es
 * lo que son: escritos, no generados por el arnés.
 *
 * Idempotente por el slug, guardado en `sourceMetadata` del brief: re-correr
 * actualiza el contenido en una versión nueva en vez de duplicar el guion.
 *
 * Uso: npm run guiones:variantes [-- --dry-run]
 */
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { brands, clients, scripts, scriptVersions } from "../src/db/schema";
import { VARIANTES_CREDITO, type VarianteGuion } from "../data/guiones-credito";
import { separarGuion } from "../src/lib/guion";
import { analyzeScript } from "../src/lib/readtime";
import { detectarVoseo } from "../src/lib/ai/registro";

const INDUSTRIA = "Reparación de crédito";
const CLIENTE = "Vertical — Reparación de crédito";
const dryRun = process.argv.includes("--dry-run");

/** Marca de origen: permite reconocer y actualizar la variante después. */
function marca(slug: string) {
  return `variante:${slug}`;
}

type Problema = { slug: string; detalle: string };

/** Revisa registro y estructura antes de tocar la base. */
function validar(v: VarianteGuion): Problema[] {
  const problemas: Problema[] = [];
  const voseo = detectarVoseo(v.contenido);
  if (voseo.length) problemas.push({ slug: v.slug, detalle: `voseo: ${voseo.join(", ")}` });

  const bloques = separarGuion(v.contenido);
  if (bloques.length < 3) {
    problemas.push({ slug: v.slug, detalle: `solo ${bloques.length} beats` });
  }
  if (!bloques.some((b) => b.rango)) {
    problemas.push({ slug: v.slug, detalle: "ningún beat declara su rango de tiempo" });
  }
  if (!bloques.some((b) => b.acotaciones.length)) {
    problemas.push({ slug: v.slug, detalle: "sin acotaciones de producción" });
  }

  // La duración locutada tiene que parecerse a la que declara el brief.
  const { totalSec } = analyzeScript(v.contenido);
  const objetivo = v.formato === "reel" ? (v.duracionSeg ?? 30) : (v.duracionMin ?? 5) * 60;
  const desvio = Math.abs(totalSec - objetivo) / objetivo;
  if (desvio > 0.45) {
    problemas.push({
      slug: v.slug,
      detalle: `duración locutada ${totalSec}s vs. objetivo ${objetivo}s (${Math.round(desvio * 100)}% de desvío)`,
    });
  }
  return problemas;
}

async function main() {
  const db = getDb();

  console.log(`${VARIANTES_CREDITO.length} variantes a revisar\n`);
  const problemas = VARIANTES_CREDITO.flatMap(validar);
  if (problemas.length) {
    console.log("Problemas encontrados:");
    for (const p of problemas) console.log(`  ✗ ${p.slug}: ${p.detalle}`);
    console.log("\nNo se importa nada hasta que estén corregidos.");
    process.exit(1);
  }
  console.log("✓ Todas pasan registro, estructura y duración.\n");

  if (dryRun) {
    for (const v of VARIANTES_CREDITO) {
      const { totalWords, totalSec } = analyzeScript(v.contenido);
      console.log(`  [${v.formato}] ${v.titulo}`);
      console.log(`      ${totalWords} palabras · ~${totalSec}s · ${v.angulo}`);
    }
    console.log("\n[dry-run] Nada se escribió.");
    return;
  }

  const [cliente] = await db.select().from(clients).where(eq(clients.name, CLIENTE)).limit(1);
  if (!cliente) throw new Error(`Falta el cliente «${CLIENTE}». Corré antes la batería.`);
  const [marcaCliente] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.clientId, cliente.id), eq(brands.industry, INDUSTRIA)))
    .limit(1);

  let creados = 0;
  let actualizados = 0;

  for (const v of VARIANTES_CREDITO) {
    const etiqueta = marca(v.slug);
    const [existente] = await db
      .select()
      .from(scripts)
      .where(and(eq(scripts.clientId, cliente.id), eq(scripts.title, v.titulo)))
      .limit(1);

    const brief = {
      producto: "Servicio de reparación y construcción de crédito con acompañamiento mensual.",
      audiencia: "Latinos en Estados Unidos con crédito dañado, invisible o con información incorrecta en su reporte.",
      oferta: "Auditoría gratuita de las tres burós con plan de acción personalizado.",
      dolores: v.angulo,
      objeciones: "",
      duracionMin: v.formato === "reel" ? 1 : (v.duracionMin ?? 5),
      ...(v.formato === "reel" ? { duracionSeg: v.duracionSeg, plataforma: v.plataforma ?? ("reels" as const) } : {}),
      tono: "Directo y cercano, español neutro de Estados Unidos.",
      cta: "Agendar la auditoría gratuita.",
      instruccionesExtra: `Variante escrita a mano (${etiqueta}). Ángulo: ${v.angulo}`,
    };

    if (existente) {
      const [ultima] = await db
        .select()
        .from(scriptVersions)
        .where(eq(scriptVersions.scriptId, existente.id))
        .orderBy(desc(scriptVersions.versionNumber))
        .limit(1);
      if (ultima?.content.trim() === v.contenido.trim()) {
        console.log(`  · sin cambios: ${v.titulo}`);
        continue;
      }
      await db.insert(scriptVersions).values({
        scriptId: existente.id,
        versionNumber: (ultima?.versionNumber ?? 0) + 1,
        content: v.contenido,
        generationParams: { provider: "openrouter", model: "manual", documentIds: [], frameworkId: null },
        refinementInstruction: "Actualización de la variante escrita a mano.",
        source: "manual",
      });
      await db.update(scripts).set({ brief, updatedAt: new Date() }).where(eq(scripts.id, existente.id));
      console.log(`  ↻ actualizado: ${v.titulo}`);
      actualizados++;
      continue;
    }

    const [script] = await db
      .insert(scripts)
      .values({
        clientId: cliente.id,
        brandId: marcaCliente?.id ?? null,
        title: v.titulo,
        format: v.formato,
        provider: "openrouter",
        model: "manual",
        status: "draft",
        brief,
      })
      .returning();

    await db.insert(scriptVersions).values({
      scriptId: script.id,
      versionNumber: 1,
      content: v.contenido,
      generationParams: { provider: "openrouter", model: "manual", documentIds: [], frameworkId: null },
      source: "manual",
    });
    console.log(`  ✓ ${v.titulo}`);
    creados++;
  }

  console.log(`\n${creados} guiones nuevos, ${actualizados} actualizados.`);
}

main().then(() => process.exit(0), (e) => { console.error(e.message); process.exit(1); });
