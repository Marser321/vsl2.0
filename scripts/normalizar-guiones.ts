/**
 * Pasa guiones ya generados de voseo rioplatense a tuteo neutro.
 *
 * El prompt pide español neutro y los prompts están escritos en tuteo, pero los
 * modelos gratuitos derivan al voseo cuando generan textos largos: los reels de
 * 30 segundos salen limpios y los VSL de varios minutos no. Esta pasada es la
 * red determinista para lo que se escapa.
 *
 * Crea una versión nueva del guion en vez de pisar la existente, para que el
 * cambio quede en el historial y se pueda comparar.
 *
 * Uso: npm run guiones:normalizar -- --ids 27,28,29,30 [--dry-run]
 */
import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../src/db";
import { scripts, scriptVersions } from "../src/db/schema";
import { detectarVoseo, normalizarATuteo } from "../src/lib/ai/registro";

function flag(nombre: string): string | null {
  const i = process.argv.indexOf(`--${nombre}`);
  return i !== -1 ? (process.argv[i + 1] ?? null) : null;
}

async function main() {
  const idsRaw = flag("ids");
  if (!idsRaw) throw new Error("Falta --ids con los guiones a normalizar (ej: --ids 27,28,29).");
  const ids = idsRaw.split(",").map((s) => Number.parseInt(s.trim(), 10)).filter(Number.isFinite);
  const dryRun = process.argv.includes("--dry-run");
  const db = getDb();

  const filas = await db.select().from(scripts).where(inArray(scripts.id, ids));
  let tocados = 0;

  for (const script of filas) {
    const [ultima] = await db
      .select()
      .from(scriptVersions)
      .where(eq(scriptVersions.scriptId, script.id))
      .orderBy(desc(scriptVersions.versionNumber))
      .limit(1);
    if (!ultima) continue;

    const { texto, cambios } = normalizarATuteo(ultima.content);
    if (!cambios.length) {
      console.log(`  · #${script.id} ya está en tuteo: ${script.title}`);
      continue;
    }

    const muestra = cambios.slice(0, 6).map((c) => `${c.de}→${c.a}`).join(", ");
    console.log(`  ${dryRun ? "·" : "✓"} #${script.id} ${cambios.length} cambios (${muestra}${cambios.length > 6 ? ", …" : ""})`);

    const quedan = detectarVoseo(texto);
    if (quedan.length) console.log(`      ⚠ sin resolver: ${quedan.join(", ")}`);

    if (!dryRun) {
      await db.insert(scriptVersions).values({
        scriptId: script.id,
        versionNumber: ultima.versionNumber + 1,
        content: texto,
        generationParams: ultima.generationParams,
        refinementInstruction: "Normalización automática de voseo a tuteo neutro.",
        source: "manual",
        usage: null,
      });
      await db.update(scripts).set({ updatedAt: new Date() }).where(eq(scripts.id, script.id));
    }
    tocados++;
  }

  console.log(`\n${dryRun ? "[dry-run] " : ""}${tocados} guiones ${dryRun ? "se normalizarían" : "normalizados"} (versión nueva, la anterior queda en el historial).`);
}

main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
