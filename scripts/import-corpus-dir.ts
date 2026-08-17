/**
 * Importador masivo de guiones a la biblioteca por vertical.
 *
 * Toma una carpeta con .docx/.pdf/.txt/.md, extrae el texto, clasifica formato
 * y tipo, y los carga como `documents` con `visibility='industry'` para que
 * entren solos al Bloque 1.5 del contexto de generación.
 *
 * Trabaja en dos pasos a propósito: primero produce un manifiesto JSON con lo
 * que piensa hacer, para que vos lo corrijas a mano; recién después inserta.
 * Etiquetar mal 30 documentos sin poder auditarlo sale más caro que la pasada
 * extra.
 *
 *   1) npm run corpus:import -- --dir ~/guiones --industria "Reparación de crédito"
 *      → escribe corpus-manifiesto.json y no toca la base
 *   2) (revisás y corregís el JSON a mano)
 *   3) npm run corpus:import -- --aplicar corpus-manifiesto.json
 *
 * Idempotente: la huella sha256 del texto colapsado vive en
 * `documents.content_hash`; reimportar el mismo contenido no duplica.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "../src/db";
import { documents, type DocumentKind, type ScriptFormat } from "../src/db/schema";
import { extractText } from "../src/lib/ingest/extract";
import { clasificar, contarPalabras, huellaContenido } from "../src/lib/ingest/classify";
import { partirCompilado, tituloDeGuion } from "../src/lib/ingest/split";
import { saveOriginal, safeFilename } from "../src/lib/ingest/storage";
import { estimateTokens } from "../src/lib/ai/tokens";
import { industrySlug } from "../src/lib/industry";
import { generateJSON } from "../src/lib/ai/structured";

const EXTENSIONES = new Set([".docx", ".pdf", ".txt", ".md"]);
const MANIFIESTO_DEFAULT = "corpus-manifiesto.json";
/** Cuántos documentos manda por llamada la pasada de clasificación con modelo. */
const LOTE_CLASIFICACION = 10;
/** Cuánto texto de cada documento alcanza para clasificarlo. */
const MUESTRA_CHARS = 1500;
/**
 * Un PDF de texto ronda las decenas de bytes por palabra extraída; uno de
 * imágenes escaneadas, los miles. Por encima de este umbral lo que se extrajo
 * son encabezados sueltos y el guion real vive en píxeles: importarlo cargaría
 * basura al corpus sin que nadie lo note.
 */
const BYTES_POR_PALABRA_ESCANEADO = 2000;

type EntradaManifiesto = {
  archivo: string;
  /**
   * Número del guion dentro de un compilado (0 = el insignia). Ausente cuando
   * el archivo es un guion suelto.
   */
  guion?: number;
  titulo: string;
  formato: ScriptFormat | null;
  kind: DocumentKind;
  industria: string;
  motivo: string;
  palabras: number;
  huella: string;
  /** Se completa en la corrida de clasificación; solo informativo. */
  tags: string[];
  /** Los PDFs escaneados llegan vacíos: hay que pegarlos a mano. */
  problema?: string;
};

type Manifiesto = {
  generadoEn: string;
  dir: string;
  lote: string;
  entradas: EntradaManifiesto[];
};

const CLASIFICACION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["documentos"],
  properties: {
    documentos: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["archivo", "formato", "tema", "angulos"],
        properties: {
          archivo: { type: "string" },
          formato: { type: "string", enum: ["vsl", "reel"] },
          tema: { type: "string" },
          angulos: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;

function flag(nombre: string): string | null {
  const index = process.argv.indexOf(`--${nombre}`);
  return index !== -1 ? (process.argv[index + 1] ?? null) : null;
}

/** Identifica una entrada: el archivo, o el archivo y el guion dentro de él. */
function claveTexto(entrada: Pick<EntradaManifiesto, "archivo" | "guion">): string {
  return entrada.guion === undefined ? entrada.archivo : `${entrada.archivo}#${entrada.guion}`;
}

/** Lista recursiva de archivos importables bajo `dir`. */
async function listarArchivos(dir: string, raiz = dir): Promise<string[]> {
  const entradas = await readdir(dir, { withFileTypes: true });
  const archivos: string[] = [];
  for (const entrada of entradas) {
    const ruta = join(dir, entrada.name);
    if (entrada.name.startsWith(".")) continue;
    if (entrada.isDirectory()) {
      archivos.push(...(await listarArchivos(ruta, raiz)));
    } else if (EXTENSIONES.has(extname(entrada.name).toLowerCase())) {
      archivos.push(relative(raiz, ruta));
    }
  }
  return archivos.sort();
}

function mimePorExtension(archivo: string): string {
  switch (extname(archivo).toLowerCase()) {
    case ".pdf":
      return "application/pdf";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".md":
      return "text/markdown";
    default:
      return "text/plain";
  }
}

// ─── Paso 1: escanear y clasificar ───────────────────────────────────────────

async function escanear() {
  const dir = flag("dir");
  if (!dir) throw new Error("Falta --dir con la carpeta de guiones.");
  const industria = flag("industria") ?? "";
  if (!industria) throw new Error('Falta --industria (ej: --industria "Reparación de crédito").');
  const lote = flag("lote") ?? `import-${new Date().toISOString().slice(0, 10)}`;
  const salida = flag("out") ?? MANIFIESTO_DEFAULT;
  const usarModelo = process.argv.includes("--clasificar");

  const archivos = await listarArchivos(dir);
  if (!archivos.length) throw new Error(`No hay archivos importables (${[...EXTENSIONES].join(", ")}) en ${dir}.`);
  console.log(`Encontrados ${archivos.length} archivos en ${dir}\n`);

  const entradas: EntradaManifiesto[] = [];
  const textos = new Map<string, string>();

  for (const archivo of archivos) {
    const buffer = await readFile(join(dir, archivo));
    const { text, warning } = await extractText(buffer, mimePorExtension(archivo), archivo);
    const tituloArchivo = archivo.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();

    const palabras = contarPalabras(text);
    const escaneado = palabras > 0 && buffer.length / palabras > BYTES_POR_PALABRA_ESCANEADO;
    if (!text || escaneado) {
      const problema = escaneado
        ? `Parece escaneado: ${buffer.length} bytes para ${palabras} palabras extraíbles. El texto está en imágenes.`
        : (warning ?? "No se pudo extraer texto.");
      entradas.push({
        archivo,
        titulo: tituloArchivo,
        formato: null,
        kind: "winning_script",
        industria,
        motivo: "sin texto",
        palabras,
        huella: "",
        tags: [],
        problema,
      });
      console.log(`  [✗] ${archivo} — ${escaneado ? "escaneado (texto en imágenes)" : "sin texto extraíble"}`);
      continue;
    }

    // Un compilado de N guiones se carga como N documentos: uno solo arruina
    // el armado de lotes de la destilación y no se puede elegir suelto.
    const partes = partirCompilado(text);
    if (partes.length >= 2) {
      for (const parte of partes) {
        const clasificacion = clasificar(parte.texto);
        entradas.push({
          archivo,
          guion: parte.numero,
          titulo: tituloDeGuion(parte, tituloArchivo),
          formato: clasificacion.format,
          kind: clasificacion.kind,
          industria,
          motivo: clasificacion.motivo,
          palabras: contarPalabras(parte.texto),
          huella: huellaContenido(parte.texto),
          tags: parte.estilo ? [`estilo:${parte.estilo.toLowerCase()}`] : [],
        });
        textos.set(`${archivo}#${parte.numero}`, parte.texto);
      }
      const formatos = [...new Set(partes.map((p) => clasificar(p.texto).format ?? "?"))];
      console.log(`  [${formatos.join("/")}] ${archivo} — compilado partido en ${partes.length} guiones`);
      continue;
    }

    const clasificacion = clasificar(text);
    entradas.push({
      archivo,
      titulo: tituloArchivo,
      formato: clasificacion.format,
      kind: clasificacion.kind,
      industria,
      motivo: clasificacion.motivo,
      palabras: contarPalabras(text),
      huella: huellaContenido(text),
      tags: [],
    });
    textos.set(archivo, text);
    console.log(`  [${clasificacion.format ?? "?"}] ${archivo} — ${clasificacion.motivo}`);
  }

  // Pasada con modelo solo para lo que la heurística no pudo resolver.
  const dudosos = entradas.filter((e) => !e.formato && !e.problema);
  if (usarModelo && dudosos.length) {
    console.log(`\nClasificando ${dudosos.length} dudosos con modelo, en lotes de ${LOTE_CLASIFICACION}…`);
    for (let i = 0; i < dudosos.length; i += LOTE_CLASIFICACION) {
      const lote = dudosos.slice(i, i + LOTE_CLASIFICACION);
      const muestras = lote
        .map((e) => `### ${claveTexto(e)}\n${(textos.get(claveTexto(e)) ?? "").slice(0, MUESTRA_CHARS)}`)
        .join("\n\n");
      try {
        const resultado = await generateJSON<{
          documentos: Array<{ archivo: string; formato: ScriptFormat; tema: string; angulos: string[] }>;
        }>({
          systemBlocks: [
            {
              text: "Sos un analista de guiones de respuesta directa. Clasificás material publicitario en dos formatos: 'vsl' (video de venta largo, minutos de duración, estructura extensa) y 'reel' (video vertical corto de 15 a 90 segundos, ritmo rápido, texto en pantalla).",
            },
          ],
          userMessage: `Clasificá cada documento. Devolvé una entrada por archivo, con el nombre exacto del archivo.\n\n${muestras}`,
          schema: CLASIFICACION_SCHEMA as unknown as Record<string, unknown>,
          // Trabajo mecánico: un modelo alcanza y cuesta 1 de cuota, no 6.
          ensemble: false,
        });
        for (const doc of resultado.documentos) {
          const entrada = entradas.find((e) => claveTexto(e) === doc.archivo);
          if (!entrada) continue;
          entrada.formato = doc.formato;
          entrada.motivo = `clasificado por modelo: ${doc.tema}`;
          entrada.tags = doc.angulos.slice(0, 5);
        }
        console.log(`  lote ${i / LOTE_CLASIFICACION + 1}: ${resultado.documentos.length} clasificados`);
      } catch (error) {
        console.warn(`  lote ${i / LOTE_CLASIFICACION + 1} falló: ${(error as Error).message}`);
      }
    }
  } else if (dudosos.length) {
    console.log(`\n${dudosos.length} archivos quedaron sin formato. Corregilos a mano en el manifiesto, o volvé a correr con --clasificar.`);
  }

  const manifiesto: Manifiesto = {
    generadoEn: new Date().toISOString(),
    dir,
    lote,
    entradas,
  };
  await writeFile(salida, JSON.stringify(manifiesto, null, 2), "utf-8");

  const conProblema = entradas.filter((e) => e.problema);
  console.log(`\nManifiesto escrito en ${salida}`);
  console.log(`  ${entradas.length - conProblema.length} listos, ${conProblema.length} sin texto extraíble.`);
  if (conProblema.length) {
    console.log("\nSin texto extraíble (probablemente PDFs escaneados — pegalos a mano en /biblioteca):");
    for (const e of conProblema) console.log(`  · ${e.archivo}`);
  }
  console.log(`\nRevisá el manifiesto y aplicalo con:\n  npm run corpus:import -- --aplicar ${salida}`);
}

// ─── Paso 2: aplicar el manifiesto ───────────────────────────────────────────

async function aplicar(rutaManifiesto: string) {
  const sinSubida = process.argv.includes("--sin-subida");
  const manifiesto: Manifiesto = JSON.parse(await readFile(rutaManifiesto, "utf-8"));
  const db = getDb();

  const utilizables = manifiesto.entradas.filter((e) => !e.problema);
  const huellas = utilizables.map((e) => e.huella);
  const existentes = huellas.length
    ? await db
        .select({ contentHash: documents.contentHash })
        .from(documents)
        .where(inArray(documents.contentHash, huellas))
    : [];
  const yaCargadas = new Set(existentes.map((row) => row.contentHash));

  let insertados = 0;
  let duplicados = 0;
  let fallidos = 0;
  // Un compilado se extrae una sola vez aunque aporte cincuenta entradas.
  const cacheTextos = new Map<string, string>();

  for (const entrada of utilizables) {
    if (yaCargadas.has(entrada.huella)) {
      console.log(`  · duplicado, se saltea: ${entrada.archivo}`);
      duplicados++;
      continue;
    }

    const slug = industrySlug(entrada.industria);
    if (!slug) {
      console.warn(`  ✗ ${entrada.archivo}: industria vacía o inválida`);
      fallidos++;
      continue;
    }

    try {
      const buffer = await readFile(join(manifiesto.dir, entrada.archivo));
      const textoArchivo = cacheTextos.get(entrada.archivo)
        ?? (await extractText(buffer, mimePorExtension(entrada.archivo), entrada.archivo)).text;
      cacheTextos.set(entrada.archivo, textoArchivo);

      // En un compilado, cada entrada es un guion: hay que reencontrarlo por
      // número, no cargar el archivo entero.
      let text = textoArchivo;
      if (entrada.guion !== undefined) {
        const parte = partirCompilado(textoArchivo).find((p) => p.numero === entrada.guion);
        if (!parte) {
          console.warn(`  ✗ ${entrada.titulo}: no se reencontró el guion ${entrada.guion} en ${entrada.archivo}`);
          fallidos++;
          continue;
        }
        text = parte.texto;
      }

      if (!text) {
        console.warn(`  ✗ ${entrada.archivo}: sin texto extraíble`);
        fallidos++;
        continue;
      }

      const filename = safeFilename(entrada.archivo.replace(/\//g, "-"));
      const [row] = await db
        .insert(documents)
        .values({
          clientId: null,
          visibility: "industry",
          industry: entrada.industria,
          industrySlug: slug,
          format: entrada.formato,
          contentHash: entrada.huella,
          title: entrada.titulo,
          kind: entrada.kind,
          filename,
          mimeType: mimePorExtension(entrada.archivo),
          sourcePlatform: "upload",
          sourceMetadata: {
            rutaOriginal: entrada.archivo,
            lote: manifiesto.lote,
            ...(entrada.guion !== undefined ? { guionEnCompilado: entrada.guion } : {}),
          },
          extractedText: text,
          tokenCount: estimateTokens(text),
          language: "es",
          tags: [`lote:${manifiesto.lote}`, `vertical:${slug}`, ...entrada.tags],
          isActive: true,
        })
        .returning();

      // El original de un compilado es el mismo PDF para todos sus guiones:
      // subirlo una vez por guion multiplicaría el bucket sin ganar nada.
      // Queda referenciado en `sourceMetadata.rutaOriginal`.
      if (!sinSubida && entrada.guion === undefined) {
        const filePath = await saveOriginal({
          documentId: row.id,
          buffer,
          filename,
          mimeType: row.mimeType,
        });
        await db.update(documents).set({ filePath }).where(eq(documents.id, row.id));
      }

      // Marcar en memoria para que dos archivos idénticos del mismo lote no
      // entren los dos (la consulta previa solo vio lo que ya estaba en la base).
      yaCargadas.add(entrada.huella);
      console.log(`  ✓ ${entrada.titulo} [${entrada.formato ?? "agnóstico"}] ~${row.tokenCount} tokens`);
      insertados++;
    } catch (error) {
      console.error(`  ✗ ${entrada.archivo}: ${(error as Error).message}`);
      fallidos++;
    }
  }

  const total = await db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.visibility, "industry"), eq(documents.isActive, true)));

  console.log(
    `\nImportación OK: ${insertados} nuevos, ${duplicados} duplicados salteados, ${fallidos} con error.` +
      `\nLa biblioteca por vertical tiene ahora ${total.length} documentos activos.`
  );
  if (insertados > 0) {
    console.log(`\nSiguiente paso — destilar los patrones del vertical:\n  npm run corpus:destilar -- --industria "${utilizables[0].industria}"`);
  }
}

async function main() {
  const rutaManifiesto = flag("aplicar");
  if (rutaManifiesto) {
    await aplicar(rutaManifiesto);
  } else {
    await escanear();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(`\n${(error as Error).message}`);
    process.exit(1);
  }
);
