import { separarGuion } from "./guion";

/**
 * Recalcula los rangos de tiempo de un guion según lo que realmente toma
 * locutar cada beat.
 *
 * Al escribir un guion se estiman los tiempos a ojo, y casi siempre quedan
 * cortos: un beat que uno imagina en tres segundos termina con veinte palabras.
 * Si el creador graba siguiendo esos rangos, se pasa del largo objetivo. Esto
 * los ajusta a la locución real, que es lo único que se dice frente a cámara.
 */

/** Reels: ritmo de lectura a cámara. VSL: locución de video de venta. */
export const PALABRAS_POR_SEGUNDO_REEL = 2.5;
export const PALABRAS_POR_MINUTO_VSL = 150;

function contar(texto: string): number {
  return texto.split(/\s+/).filter(Boolean).length;
}

function mmss(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.round(segundos % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export type ResultadoTiempos = {
  contenido: string;
  /** Duración total de la locución, en segundos. */
  totalSec: number;
  ajustes: Array<{ beat: string; antes: string | null; ahora: string }>;
};

/**
 * Devuelve el guion con los encabezados de beat reescritos con su rango real.
 * Los beats sin locución (solo acotaciones) conservan el rango que tenían: no
 * hay nada que cronometrar en ellos.
 */
export function ajustarTiempos(
  markdown: string,
  formato: "vsl" | "reel"
): ResultadoTiempos {
  const bloques = separarGuion(markdown);
  const porSegundo =
    formato === "reel" ? PALABRAS_POR_SEGUNDO_REEL : PALABRAS_POR_MINUTO_VSL / 60;

  const ajustes: ResultadoTiempos["ajustes"] = [];
  let cursor = 0;
  const rangos = new Map<string, string>();

  for (const bloque of bloques) {
    const palabras = contar(bloque.locucion.join(" "));
    if (!palabras) continue;
    const duracion = Math.max(2, Math.round(palabras / porSegundo));
    const rango = `${mmss(cursor)}–${mmss(cursor + duracion)}`;
    rangos.set(bloque.titulo, rango);
    ajustes.push({ beat: bloque.titulo, antes: bloque.rango, ahora: rango });
    cursor += duracion;
  }

  // Se reescribe solo el paréntesis del encabezado; el resto del guion queda igual.
  const contenido = markdown
    .split("\n")
    .map((linea) => {
      const h = linea.match(/^(##\s+)(.+?)(?:\s*\(([^)]*\d[^)]*)\))?\s*$/);
      if (!h) return linea;
      const titulo = h[2].trim();
      const rango = rangos.get(titulo);
      return rango ? `${h[1]}${titulo} (${rango})` : linea;
    })
    .join("\n");

  return { contenido, totalSec: cursor, ajustes };
}
