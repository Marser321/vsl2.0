/**
 * Destila los patrones recurrentes de un vertical — el "mínimo común múltiplo"
 * de todos los guiones que se cargaron para ese rubro.
 *
 * Map-reduce sobre la biblioteca de industria:
 *   MAP    — cada lote de guiones produce patrones parciales, con un solo
 *            modelo por lote (1 llamada de cuota, no 6).
 *   REDUCE — se consolidan contando en cuántos lotes apareció cada patrón; los
 *            corroborados pasan por el panel 5+1 una sola vez para redactarlos
 *            como reglas accionables.
 *
 * Salidas, todas idempotentes:
 *   · `industry_learnings` con `is_active=false` → se aprueban en /aprendizajes.
 *   · Un `documents` de doctrina por formato (vsl y reel) con
 *     `visibility='industry'` → entra al Bloque 1.5 de toda generación del rubro.
 *
 * Uso: npm run corpus:destilar -- --industria "Reparación de crédito"
 *      npm run corpus:destilar -- --industria "…" --formato reel
 */
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../src/db";
import { documents, industryLearnings, type Document, type ScriptFormat } from "../src/db/schema";
import { generateJSON } from "../src/lib/ai/structured";
import { getOpenRouterQuota } from "../src/lib/ai/openrouter";
import { getSetting } from "../src/lib/settings";
import { anonymizeLearning } from "../src/lib/intake/anonymize";
import { industrySlug } from "../src/lib/industry";
import { estimateTokens } from "../src/lib/ai/tokens";
import {
  armarLotes,
  consolidarPatrones,
  patronesCorroborados,
  renderDoctrina,
  CATEGORIAS_PATRON,
  type Patron,
} from "../src/lib/ai/distill";

/**
 * Presupuesto de tokens por lote. Los modelos gratuitos del arnés tienen un
 * piso de 60k de contexto; 35k deja lugar de sobra para el prompt y la salida.
 */
const PRESUPUESTO_LOTE = 35_000;
/**
 * Mínimo de lotes cuando el corpus es de piezas cortas.
 *
 * La evidencia de un patrón es en cuántos lotes INDEPENDIENTES apareció. Con
 * cien reels de doscientos tokens el corpus entero entra en un solo lote, y un
 * solo lote no corrobora nada: todo patrón tendría evidencia 1. Partirlo en
 * varios grupos hace que la repetición signifique algo.
 */
const LOTES_MINIMOS = 6;

/** Presupuesto por lote, achicado si con el tope el corpus daría muy pocos lotes. */
function presupuestoPorLote(tokensTotales: number): number {
  return Math.min(PRESUPUESTO_LOTE, Math.ceil(tokensTotales / LOTES_MINIMOS));
}

const PATRONES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["patrones"],
  properties: {
    patrones: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["categoria", "etiqueta", "patron", "ejemplo"],
        properties: {
          categoria: { type: "string", enum: [...CATEGORIAS_PATRON] },
          etiqueta: { type: "string" },
          patron: { type: "string" },
          ejemplo: { type: "string" },
        },
      },
    },
  },
} as const;

const REGLAS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["reglas"],
  properties: {
    reglas: { type: "array", items: { type: "string" } },
  },
} as const;

const INSTRUCCION_ANONIMATO =
  "No copies frases textuales de los guiones, ni nombres de marca, personas, URLs, precios ni cifras privadas. " +
  "Parafraseá siempre: el resultado tiene que servir para cualquier cliente del rubro.";

function flag(nombre: string): string | null {
  const index = process.argv.indexOf(`--${nombre}`);
  return index !== -1 ? (process.argv[index + 1] ?? null) : null;
}

/** Documentos del vertical que aplican a un formato (los agnósticos entran a ambos). */
function paraFormato(docs: Document[], formato: ScriptFormat): Document[] {
  return docs.filter((doc) => doc.format === formato || doc.format === null);
}

async function mapearLote(args: {
  documentos: Document[];
  industria: string;
  formato: ScriptFormat;
  systemPrompt: string;
}): Promise<Patron[]> {
  const cuerpo = args.documentos
    .map((doc, i) => `### Guion ${i + 1}: ${doc.title}\n${doc.extractedText}`)
    .join("\n\n---\n\n");

  const resultado = await generateJSON<{ patrones: Patron[] }>({
    systemBlocks: [{ text: args.systemPrompt, cache: true }],
    userMessage:
      `Analizá estos guiones de ${args.formato === "reel" ? "reels" : "VSL"} del rubro "${args.industria}" ` +
      `y extraé los patrones que SE REPITEN entre ellos. Ignorá lo que aparece en uno solo.\n\n` +
      `Categorías:\n` +
      `- ganchos: cómo abren y qué ángulo usan para frenar el scroll.\n` +
      `- mecanismos: el "cómo funciona" que da credibilidad a la promesa.\n` +
      `- secuencias_de_prueba: en qué orden aparecen testimonios, datos y autoridad.\n` +
      `- objeciones: qué resistencia atacan y con qué argumento.\n` +
      `- beats: la estructura recurrente, beat a beat.\n` +
      `- lexico: palabras y expresiones propias del avatar de este rubro.\n\n` +
      `Cada patrón lleva:\n` +
      `- etiqueta: nombre canónico de 2 a 4 palabras, en minúsculas, sin artículos ` +
      `("contraste antes despues", "miedo perder casa", "objecion precio"). Usá el nombre más ` +
      `estándar posible: la misma técnica tiene que recibir la misma etiqueta aunque el guion la ejecute distinto.\n` +
      `- patron: la regla accionable (no una descripción).\n` +
      `- ejemplo: parafraseado.\n` +
      `${INSTRUCCION_ANONIMATO}\n\n${cuerpo}`,
    schema: PATRONES_SCHEMA as unknown as Record<string, unknown>,
    // MAP es trabajo de volumen: un modelo por lote. El consenso se paga en REDUCE.
    ensemble: false,
    maxTokens: 8192,
  });
  return resultado.patrones;
}

async function destilar() {
  const industriaRaw = flag("industria");
  if (!industriaRaw) throw new Error('Falta --industria (ej: --industria "Reparación de crédito").');
  const slug = industrySlug(industriaRaw);
  if (!slug) throw new Error(`"${industriaRaw}" no produce un slug de rubro válido.`);
  const formatoPedido = flag("formato") as ScriptFormat | null;
  const formatos: ScriptFormat[] = formatoPedido ? [formatoPedido] : ["vsl", "reel"];

  const db = getDb();
  const corpus = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.visibility, "industry"),
        eq(documents.industrySlug, slug),
        eq(documents.isActive, true),
        inArray(documents.kind, ["winning_script", "transcript", "reference"])
      )
    );

  if (!corpus.length) {
    throw new Error(
      `No hay guiones cargados para el vertical "${slug}".\n` +
        `Importalos primero:\n  npm run corpus:import -- --dir <carpeta> --industria "${industriaRaw}"`
    );
  }

  // Presupuesto: 1 llamada por lote (MAP) + 6 por formato (REDUCE).
  const tokensDe = (doc: Document) => doc.tokenCount || estimateTokens(doc.extractedText);
  const lotesPorFormato = formatos.map((formato) => {
    const docs = paraFormato(corpus, formato);
    const total = docs.reduce((suma, doc) => suma + tokensDe(doc), 0);
    return armarLotes(docs, tokensDe, presupuestoPorLote(total));
  });
  const llamadasEstimadas = lotesPorFormato.reduce((total, lotes) => total + lotes.length, 0) + formatos.length * 6;
  const cuota = await getOpenRouterQuota();
  console.log(
    `Vertical "${slug}": ${corpus.length} documentos.\n` +
      `Estimado: ~${llamadasEstimadas} llamadas. Cuota disponible hoy: ${cuota.remaining}/${cuota.limit}.\n`
  );
  if (cuota.available && cuota.remaining < llamadasEstimadas) {
    console.warn(
      `⚠ La cuota puede no alcanzar. Podés correr un formato por vez con --formato vsl / --formato reel.\n`
    );
  }

  const systemPrompt = await getSetting("system_prompt");

  for (const [i, formato] of formatos.entries()) {
    const docsDelFormato = paraFormato(corpus, formato);
    const lotes = lotesPorFormato[i];
    if (!docsDelFormato.length) {
      console.log(`\n[${formato}] sin documentos, se saltea.`);
      continue;
    }

    console.log(`\n[${formato}] ${docsDelFormato.length} documentos en ${lotes.length} lotes`);

    // ── MAP ──────────────────────────────────────────────────────────────────
    const patronesPorLote: Patron[][] = [];
    for (const lote of lotes) {
      try {
        const patrones = await mapearLote({
          documentos: lote.documentos,
          industria: industriaRaw,
          formato,
          systemPrompt,
        });
        patronesPorLote.push(patrones);
        console.log(`  lote ${lote.indice + 1}/${lotes.length}: ${patrones.length} patrones (~${lote.tokensEstimados} tokens)`);
      } catch (error) {
        console.warn(`  lote ${lote.indice + 1}/${lotes.length} falló: ${(error as Error).message}`);
      }
    }

    if (!patronesPorLote.length) {
      console.warn(`[${formato}] ningún lote produjo patrones. Se saltea.`);
      continue;
    }

    // ── REDUCE ───────────────────────────────────────────────────────────────
    const consolidados = consolidarPatrones(patronesPorLote);
    const corroborados = patronesCorroborados(consolidados, patronesPorLote.length);
    console.log(`  consolidado: ${consolidados.length} patrones, ${corroborados.length} corroborados por más de un lote`);

    if (!corroborados.length) {
      console.warn(`[${formato}] ningún patrón se repitió entre lotes. Nada que guardar.`);
      continue;
    }

    // Doctrina del vertical → biblioteca por rubro (Bloque 1.5).
    const doctrina = renderDoctrina({
      industria: industriaRaw,
      formato,
      patrones: corroborados,
      totalDocumentos: docsDelFormato.length,
      totalLotes: patronesPorLote.length,
    });
    const tagDoctrina = `destilado:${slug}:${formato}`;
    const [existente] = await db
      .select({ id: documents.id })
      .from(documents)
      .where(and(eq(documents.visibility, "industry"), eq(documents.industrySlug, slug), eq(documents.format, formato), eq(documents.kind, "framework")));

    if (existente) {
      await db
        .update(documents)
        .set({ extractedText: doctrina, tokenCount: estimateTokens(doctrina) })
        .where(eq(documents.id, existente.id));
      console.log(`  ✓ doctrina actualizada (documento #${existente.id})`);
    } else {
      const [row] = await db
        .insert(documents)
        .values({
          clientId: null,
          visibility: "industry",
          industry: industriaRaw,
          industrySlug: slug,
          format: formato,
          title: `Anatomía del ${formato.toUpperCase()} de ${industriaRaw}`,
          kind: "framework",
          extractedText: doctrina,
          tokenCount: estimateTokens(doctrina),
          language: "es",
          tags: [tagDoctrina, `vertical:${slug}`],
          isActive: true,
        })
        .returning();
      console.log(`  ✓ doctrina creada (documento #${row.id}, ~${row.tokenCount} tokens)`);
    }

    // Reglas accionables → industry_learnings pendientes de aprobación.
    try {
      const { reglas } = await generateJSON<{ reglas: string[] }>({
        systemBlocks: [{ text: systemPrompt, cache: true }],
        userMessage:
          `Convertí estos patrones destilados de ${docsDelFormato.length} guiones de ${formato === "reel" ? "reels" : "VSL"} ` +
          `del rubro "${industriaRaw}" en 8 a 12 reglas accionables para escribir guiones nuevos.\n` +
          `Cada regla: una frase imperativa, concreta, que un redactor pueda aplicar sin leer los guiones originales.\n` +
          `${INSTRUCCION_ANONIMATO}\n\n` +
          corroborados
            .map((p) => `- [${p.categoria}] ${p.patron} (evidencia: ${p.evidencia} lotes)`)
            .join("\n"),
        schema: REGLAS_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 4096,
      });

      // Doble red: el prompt pide parafrasear, y esto barre lo que se escape.
      const limpias = reglas.map(anonymizeLearning).filter(Boolean);
      const existentes = await db
        .select({ content: industryLearnings.content })
        .from(industryLearnings)
        .where(eq(industryLearnings.industrySlug, slug));
      const yaEstan = new Set(existentes.map((row) => row.content));
      const nuevas = limpias.filter((regla) => !yaEstan.has(regla));

      if (nuevas.length) {
        await db.insert(industryLearnings).values(
          nuevas.map((content) => ({
            industry: industriaRaw,
            subindustry: null,
            industrySlug: slug,
            subindustrySlug: null,
            content,
            // Cuántos lotes respaldan el patrón más fuerte que las originó.
            evidenceCount: corroborados[0]?.evidencia ?? 1,
            isActive: false,
          }))
        );
      }
      console.log(`  ✓ ${nuevas.length} reglas nuevas pendientes de aprobación (${limpias.length - nuevas.length} ya existían)`);
    } catch (error) {
      console.warn(`  ✗ no se pudieron redactar las reglas: ${(error as Error).message}`);
    }
  }

  console.log(
    `\nDestilación terminada.\n` +
      `Revisá y aprobá las reglas en /aprendizajes — hasta que las actives no entran al contexto de generación.`
  );
}

destilar().then(
  () => process.exit(0),
  (error) => {
    console.error(`\n${(error as Error).message}`);
    process.exit(1);
  }
);
