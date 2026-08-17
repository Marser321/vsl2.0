/**
 * Genera una batería de guiones de un vertical a partir de una lista de briefs.
 *
 * No reimplementa nada: llama a `createGenerationStream`, el mismo camino que
 * usa el wizard de /generar, así que pasa por `buildContext` (con el Bloque 1.5
 * del vertical y los aprendizajes aprobados del rubro) y por el arnés 5+1.
 *
 * Pensado para correr a lo largo de varios días: cada guion cuesta 6 llamadas
 * de la cuota diaria de OpenRouter, así que el script chequea cuota antes de
 * cada uno, y guarda estado para retomar donde quedó.
 *
 * Uso:
 *   npm run bateria -- --plan data/bateria-credito.json
 *   npm run bateria -- --plan data/bateria-credito.json --solo reel
 *   npm run bateria -- --plan data/bateria-credito.json --dry-run
 */
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { getDb } from "../src/db";
import { brands, clients, frameworks, scripts, type ScriptFormat } from "../src/db/schema";
import { createGenerationStream } from "../src/lib/generation/stream";
import { generationInputSchema } from "../src/lib/generation/schema";
import { getOpenRouterQuota, OPENROUTER_CALLS_PER_RUN } from "../src/lib/ai/openrouter";
import { getSetting } from "../src/lib/settings";

type BriefPlan = {
  titulo: string;
  formato: ScriptFormat;
  /** Slug del framework a usar; si no existe, se genera sin framework. */
  framework?: string;
  duracionMin?: number;
  duracionSeg?: number;
  plataforma?: "tiktok" | "reels" | "shorts";
  producto: string;
  audiencia: string;
  oferta: string;
  dolores: string;
  objeciones?: string;
  tono?: string;
  cta: string;
  instruccionesExtra?: string;
};

type Plan = {
  /** Rubro tal como se escribe; debe coincidir con el de la biblioteca del vertical. */
  industria: string;
  cliente: string;
  marca: string;
  briefs: BriefPlan[];
};

type Estado = { generados: string[] };

function flag(nombre: string): string | null {
  const index = process.argv.indexOf(`--${nombre}`);
  return index !== -1 ? (process.argv[index + 1] ?? null) : null;
}

/** Crea el cliente y la marca del vertical si no existen. La marca lleva el
 *  rubro: es lo que engancha la generación con la biblioteca de industria. */
async function asegurarContenedor(plan: Plan) {
  const db = getDb();
  let [cliente] = await db.select().from(clients).where(eq(clients.name, plan.cliente)).limit(1);
  if (!cliente) {
    [cliente] = await db
      .insert(clients)
      .values({ name: plan.cliente, industry: plan.industria, description: `Contenedor de la batería del vertical ${plan.industria}.` })
      .returning();
    console.log(`  ✓ cliente creado: ${cliente.name} (#${cliente.id})`);
  }

  let [marca] = await db
    .select()
    .from(brands)
    .where(and(eq(brands.clientId, cliente.id), eq(brands.name, plan.marca)))
    .limit(1);
  if (!marca) {
    [marca] = await db
      .insert(brands)
      .values({ clientId: cliente.id, name: plan.marca, industry: plan.industria })
      .returning();
    console.log(`  ✓ marca creada: ${marca.name} (#${marca.id}), rubro "${plan.industria}"`);
  } else if (marca.industry !== plan.industria) {
    // Sin el rubro correcto, el Bloque 1.5 del vertical no entra al contexto.
    await db.update(brands).set({ industry: plan.industria }).where(eq(brands.id, marca.id));
    console.log(`  ✓ rubro de la marca actualizado a "${plan.industria}"`);
  }

  return { cliente, marca };
}

/** Drena el SSE de la generación hasta que termina, devolviendo el id del guion. */
async function drenarStream(response: Response): Promise<{ scriptId: number | null; error: string | null }> {
  if (!response.body) return { scriptId: null, error: "La generación no devolvió cuerpo." };
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let scriptId: number | null = null;
  let error: string | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const eventos = buffer.split("\n\n");
    buffer = eventos.pop() ?? "";
    for (const evento of eventos) {
      const linea = evento.split("\n").find((l) => l.startsWith("data:"));
      if (!linea) continue;
      try {
        const payload = JSON.parse(linea.slice(5).trim());
        if (payload.scriptId) scriptId = payload.scriptId;
        if (payload.type === "error") error = payload.message ?? "La generación falló.";
      } catch {
        // Los eventos de progreso que no son JSON no interesan acá.
      }
    }
  }
  return { scriptId, error };
}

async function generarBateria() {
  const rutaPlan = flag("plan");
  if (!rutaPlan) throw new Error("Falta --plan con el archivo de briefs (ej: data/bateria-credito.json).");
  const soloFormato = flag("solo") as ScriptFormat | null;
  const dryRun = process.argv.includes("--dry-run");

  const plan: Plan = JSON.parse(await readFile(rutaPlan, "utf-8"));
  const rutaEstado = rutaPlan.replace(/\.json$/, ".estado.json");
  const estado: Estado = existsSync(rutaEstado)
    ? JSON.parse(await readFile(rutaEstado, "utf-8"))
    : { generados: [] };

  const pendientes = plan.briefs
    .filter((brief) => !soloFormato || brief.formato === soloFormato)
    .filter((brief) => !estado.generados.includes(brief.titulo));

  console.log(
    `Plan "${rutaPlan}": ${plan.briefs.length} briefs, ${estado.generados.length} ya generados, ${pendientes.length} pendientes.`
  );
  if (!pendientes.length) {
    console.log("Nada por hacer. La batería está completa.");
    return;
  }

  const cuota = await getOpenRouterQuota();
  const necesarias = pendientes.length * OPENROUTER_CALLS_PER_RUN;
  console.log(
    `Cuota hoy: ${cuota.remaining}/${cuota.limit}. Los ${pendientes.length} pendientes necesitan ${necesarias} llamadas.\n`
  );
  if (cuota.available && cuota.remaining < necesarias) {
    const alcanzan = Math.floor(cuota.remaining / OPENROUTER_CALLS_PER_RUN);
    console.log(`Hoy alcanza para ${alcanzan}. El resto queda para mañana: volvé a correr el mismo comando.\n`);
  }

  if (dryRun) {
    console.log("[dry-run] Se generarían:");
    for (const brief of pendientes) console.log(`  · [${brief.formato}] ${brief.titulo}`);
    return;
  }

  const db = getDb();
  const { cliente, marca } = await asegurarContenedor(plan);
  const modelo = (await getSetting("default_model_openrouter")) || "openrouter/free";
  const frameworksPorSlug = new Map(
    (await db.select({ id: frameworks.id, slug: frameworks.slug }).from(frameworks)).map((f) => [f.slug, f.id])
  );

  let generados = 0;
  for (const brief of pendientes) {
    const restante = await getOpenRouterQuota();
    if (restante.available && restante.remaining < OPENROUTER_CALLS_PER_RUN) {
      console.log(`\nCuota agotada por hoy (quedan ${restante.remaining}). Retomá mañana con el mismo comando.`);
      break;
    }

    const entrada = {
      clientId: cliente.id,
      brandId: marca.id,
      frameworkId: brief.framework ? (frameworksPorSlug.get(brief.framework) ?? null) : null,
      documentIds: [] as number[],
      title: brief.titulo,
      format: brief.formato,
      provider: "openrouter" as const,
      model: modelo,
      openrouterConfirmed: true,
      brief: {
        producto: brief.producto,
        audiencia: brief.audiencia,
        oferta: brief.oferta,
        dolores: brief.dolores,
        objeciones: brief.objeciones ?? "",
        duracionMin: brief.duracionMin ?? (brief.formato === "reel" ? 1 : 5),
        duracionSeg: brief.duracionSeg,
        plataforma: brief.plataforma ?? "",
        tono: brief.tono ?? "",
        cta: brief.cta,
        instruccionesExtra: brief.instruccionesExtra ?? "",
      },
    };

    const parsed = generationInputSchema.safeParse(entrada);
    if (!parsed.success) {
      console.error(`  ✗ "${brief.titulo}": brief inválido — ${parsed.error.issues[0].message}`);
      continue;
    }

    process.stdout.write(`  · [${brief.formato}] ${brief.titulo}… `);
    try {
      const { scriptId, error } = await drenarStream(await createGenerationStream(parsed.data));
      if (error) {
        console.log(`✗ ${error}`);
        continue;
      }
      if (scriptId) {
        const [row] = await db.select({ status: scripts.status }).from(scripts).where(eq(scripts.id, scriptId)).limit(1);
        if (row?.status === "failed") {
          console.log("✗ la generación terminó en error");
          continue;
        }
      }
      console.log(`✓ guion #${scriptId ?? "?"}`);
      estado.generados.push(brief.titulo);
      await writeFile(rutaEstado, JSON.stringify(estado, null, 2), "utf-8");
      generados++;
    } catch (error) {
      console.log(`✗ ${(error as Error).message}`);
    }
  }

  const restantes = plan.briefs.filter((b) => !estado.generados.includes(b.titulo)).length;
  console.log(
    `\nBatería: ${generados} guiones nuevos en esta corrida, ${estado.generados.length}/${plan.briefs.length} completos.` +
      (restantes ? `\nQuedan ${restantes}. Volvé a correr el mismo comando cuando se renueve la cuota.` : "") +
      `\nRevisalos en /guiones y puntualos con 1-5★ — esa señal mejora la próxima batería.`
  );
}

generarBateria().then(
  () => process.exit(0),
  (error) => {
    console.error(`\n${(error as Error).message}`);
    process.exit(1);
  }
);
