/**
 * Partido de compilados en guiones individuales.
 *
 * Los entregables de la agencia vienen como un PDF con decenas de guiones
 * numerados ("GUION 7 DE 30 · POV"). Cargar el compilado entero como un solo
 * documento arruina todo lo que viene después: la destilación no puede armar
 * lotes, el wizard no puede elegir un ejemplar suelto, y el formato del
 * documento es el del compilado y no el de cada pieza.
 */

export type GuionPartido = {
  /** Número declarado en el encabezado (el insignia sin número va como 0). */
  numero: number;
  /** Encabezado tal cual, útil para el título. */
  encabezado: string;
  /** Formato editorial declarado: "POV", "SKIT, DOBLE PERSONAJE", etc. */
  estilo: string | null;
  texto: string;
};

/**
 * Encabezado de guion al principio de una línea. Cubre las tres variantes que
 * aparecen en los compilados: "GUION 7", "GUION 7 DE 30 · POV" y el insignia
 * "★ GUION INSIGNIA DE 20 · CONFESIONAL".
 */
const ENCABEZADO = /^[★\s]*GUI[OÓ]N\s+(?:(\d+)|INSIGNIA)(?:\s+DE\s+\d+)?\s*(?:·\s*(.+))?$/gim;

/** Pie de página repetido en cada hoja del PDF; no aporta al guion. */
const PIE_DE_PAGINA = /^.*CONFIDENCIAL.*$|^--\s*\d+\s+of\s+\d+\s*--$|^ad MediaSolution.*$/gim;

/** Un guion real tiene cuerpo; abajo de esto es una línea de índice. */
const MINIMO_CHARS = 200;

/**
 * Parte un compilado en guiones. Devuelve `[]` si el texto no tiene la
 * estructura esperada, para que el llamador lo trate como documento único.
 */
export function partirCompilado(texto: string): GuionPartido[] {
  const encabezados: Array<{ indice: number; largo: number; numero: number; estilo: string | null; linea: string }> = [];

  ENCABEZADO.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = ENCABEZADO.exec(texto)) !== null) {
    encabezados.push({
      indice: match.index,
      largo: match[0].length,
      // El insignia no trae número propio: va como 0 y queda primero.
      numero: match[1] ? Number.parseInt(match[1], 10) : 0,
      estilo: match[2]?.trim() || null,
      linea: match[0].trim(),
    });
  }

  if (encabezados.length < 2) return [];

  const guiones: GuionPartido[] = [];
  for (const [i, encabezado] of encabezados.entries()) {
    const hasta = encabezados[i + 1]?.indice ?? texto.length;
    const cuerpo = texto
      .slice(encabezado.indice + encabezado.largo, hasta)
      .replace(PIE_DE_PAGINA, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Las entradas del índice matchean el encabezado pero no tienen cuerpo.
    if (cuerpo.length < MINIMO_CHARS) continue;

    guiones.push({
      numero: encabezado.numero,
      encabezado: encabezado.linea,
      estilo: encabezado.estilo,
      texto: `${encabezado.linea}\n\n${cuerpo}`,
    });
  }

  return guiones;
}

/**
 * Título legible de un guion partido. Usa la primera línea con contenido del
 * cuerpo — en estos compilados es el título editorial de la pieza.
 */
export function tituloDeGuion(guion: GuionPartido, tituloCompilado: string): string {
  const lineas = guion.texto.split("\n").slice(1).map((l) => l.trim()).filter(Boolean);
  const titulo = lineas.find((l) => l.length > 3 && l.length < 120 && !/^(tiempo|la idea|hook)\b/i.test(l));
  const numero = guion.numero > 0 ? `${guion.numero}` : "insignia";
  return titulo
    ? `${tituloCompilado} · ${numero}. ${titulo.replace(/^★\s*/, "")}`
    : `${tituloCompilado} · guion ${numero}`;
}
