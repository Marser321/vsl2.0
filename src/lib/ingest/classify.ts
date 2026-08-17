import { createHash } from "node:crypto";
import type { DocumentKind, ScriptFormat } from "@/db/schema";

/**
 * Clasificación heurística de un documento importado en masa.
 *
 * La heurística resuelve la mayoría de los casos gratis y sin cuota de LLM; lo
 * que queda en la zona gris se marca `null` para que el importador lo mande a
 * una pasada de clasificación con modelo, en lotes.
 */

export type Clasificacion = {
  format: ScriptFormat | null;
  kind: DocumentKind;
  /** Por qué se decidió así — se imprime en el dry-run para poder auditarlo. */
  motivo: string;
};

/** Marcadores de guion de reel: dirección visual y texto en pantalla. */
const MARCADORES_REEL = /\[\s*(VISUAL|TEXTO EN PANTALLA|EN PANTALLA|B-ROLL)\s*:/i;
/** Timestamps en segundos: (0:00–0:03), 0:03, 00:15. Propios de reel. */
const TIMESTAMP_SEGUNDOS = /\b0:\d{2}\b/;
/** Timestamps en minutos de dos dígitos: 03:20, 12:45. Propios de VSL largo. */
const TIMESTAMP_MINUTOS = /\b(?:[1-9]|[1-5]\d):\d{2}\b/;
/** Encabezados de brief: "Audiencia:", "Oferta:", "Dolores:". */
const CAMPOS_BRIEF = /^\s*(audiencia|oferta|dolores?|objeciones?|producto|tono|cta|duración|plataforma)\s*:/gim;

const PALABRAS_REEL_MAX = 400;
const PALABRAS_VSL_MIN = 900;

export function contarPalabras(texto: string): number {
  const limpio = texto.trim();
  return limpio ? limpio.split(/\s+/).length : 0;
}

/**
 * Infiere formato y tipo de un documento por su contenido.
 * `format: null` significa "no me alcanza la evidencia" — no "agnóstico".
 */
export function clasificar(texto: string): Clasificacion {
  const palabras = contarPalabras(texto);
  const kind = inferirKind(texto, palabras);

  // Un brief describe el encargo, no es un guion: no tiene formato de salida y
  // sirve igual como contexto para un VSL que para un reel.
  if (kind === "brief") {
    return { format: null, kind, motivo: "es un brief: agnóstico de formato" };
  }

  if (MARCADORES_REEL.test(texto)) {
    return { format: "reel", kind, motivo: "tiene marcadores [VISUAL:] / [TEXTO EN PANTALLA:]" };
  }
  if (TIMESTAMP_SEGUNDOS.test(texto) && !TIMESTAMP_MINUTOS.test(texto)) {
    return { format: "reel", kind, motivo: "timestamps en segundos, ninguno en minutos" };
  }
  if (palabras > 0 && palabras < PALABRAS_REEL_MAX) {
    return { format: "reel", kind, motivo: `${palabras} palabras (< ${PALABRAS_REEL_MAX})` };
  }
  if (TIMESTAMP_MINUTOS.test(texto)) {
    return { format: "vsl", kind, motivo: "timestamps en minutos" };
  }
  if (palabras > PALABRAS_VSL_MIN) {
    return { format: "vsl", kind, motivo: `${palabras} palabras (> ${PALABRAS_VSL_MIN})` };
  }
  return { format: null, kind, motivo: `zona gris: ${palabras} palabras, sin marcadores ni timestamps` };
}

function inferirKind(texto: string, palabras: number): DocumentKind {
  const camposBrief = texto.match(CAMPOS_BRIEF)?.length ?? 0;
  // Un brief es corto y casi todo encabezados; un guion con una línea
  // "Audiencia:" suelta no lo es.
  if (camposBrief >= 3 && palabras < 600) return "brief";
  return "winning_script";
}

/**
 * Huella del contenido para deduplicar. Se calcula sobre el texto colapsado
 * (sin variaciones de espaciado ni mayúsculas) para que dos exports del mismo
 * guion con distinto formateo cuenten como uno solo.
 */
export function huellaContenido(texto: string): string {
  const colapsado = texto.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(colapsado).digest("hex");
}
