/**
 * Destilación de patrones recurrentes de un vertical — los "mínimos común
 * múltiplos" de una biblioteca de guiones.
 *
 * Map-reduce: cada lote de guiones produce patrones parciales (barato, un solo
 * modelo por lote), y una pasada final de consenso los consolida contando en
 * cuántos lotes apareció cada uno. Ese conteo es la evidencia: un patrón que
 * aparece en siete lotes de un vertical es una regla; uno que aparece en uno
 * es una casualidad.
 *
 * Todo lo de este archivo es puro y testeable; las llamadas al modelo viven en
 * `scripts/destilar-vertical.ts`.
 */

/** Categorías de patrón que se extraen de cada lote. */
export const CATEGORIAS_PATRON = [
  "ganchos",
  "mecanismos",
  "secuencias_de_prueba",
  "objeciones",
  "beats",
  "lexico",
] as const;
export type CategoriaPatron = (typeof CATEGORIAS_PATRON)[number];

export type Patron = {
  categoria: CategoriaPatron;
  /** La regla en sí, redactada como algo accionable. */
  patron: string;
  /** Ejemplo parafraseado — nunca verbatim del guion del cliente. */
  ejemplo: string;
};

export type PatronConsolidado = Patron & {
  /** En cuántos lotes independientes apareció. */
  evidencia: number;
};

export type LoteDocumentos<T> = {
  indice: number;
  documentos: T[];
  tokensEstimados: number;
};

/**
 * Agrupa documentos en lotes que entren en el presupuesto de contexto.
 *
 * Los modelos gratuitos del arnés tienen un piso de 60k de contexto, así que el
 * presupuesto por lote se queda bastante abajo para dejar lugar al prompt y a
 * la respuesta. Un documento más grande que el presupuesto va solo en su lote:
 * es mejor procesarlo aunque se trunque que descartarlo.
 */
export function armarLotes<T>(
  documentos: T[],
  tokensDe: (documento: T) => number,
  presupuestoPorLote: number
): LoteDocumentos<T>[] {
  const lotes: LoteDocumentos<T>[] = [];
  let actual: T[] = [];
  let acumulado = 0;

  for (const documento of documentos) {
    const tokens = tokensDe(documento);
    if (actual.length > 0 && acumulado + tokens > presupuestoPorLote) {
      lotes.push({ indice: lotes.length, documentos: actual, tokensEstimados: acumulado });
      actual = [];
      acumulado = 0;
    }
    actual.push(documento);
    acumulado += tokens;
  }
  if (actual.length > 0) {
    lotes.push({ indice: lotes.length, documentos: actual, tokensEstimados: acumulado });
  }
  return lotes;
}

/**
 * Clave de comparación de dos patrones: minúsculas, sin acentos, sin
 * puntuación y sin palabras vacías. Dos redacciones distintas de la misma
 * regla tienen que colapsar, o `evidencia` no significa nada.
 */
const VACIAS = new Set([
  "el", "la", "los", "las", "un", "una", "unos", "unas", "de", "del", "al", "a",
  "en", "y", "o", "que", "con", "por", "para", "su", "sus", "se", "lo", "es",
  "como", "más", "mas", "sin", "sobre", "the", "of",
]);

export function clavePatron(patron: string): string {
  return patron
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((palabra) => palabra.length > 2 && !VACIAS.has(palabra))
    .sort()
    .join(" ");
}

/**
 * Consolida los patrones de todos los lotes contando en cuántos apareció cada
 * uno. Se queda con la redacción más larga de cada grupo (suele ser la más
 * específica) y ordena por evidencia descendente.
 */
export function consolidarPatrones(patronesPorLote: Patron[][]): PatronConsolidado[] {
  const grupos = new Map<string, { patron: Patron; lotes: Set<number> }>();

  patronesPorLote.forEach((patrones, indiceLote) => {
    for (const patron of patrones) {
      if (!patron.patron?.trim()) continue;
      const clave = `${patron.categoria}::${clavePatron(patron.patron)}`;
      const grupo = grupos.get(clave);
      if (grupo) {
        grupo.lotes.add(indiceLote);
        // La redacción más larga suele ser la más accionable.
        if (patron.patron.length > grupo.patron.patron.length) grupo.patron = patron;
      } else {
        grupos.set(clave, { patron, lotes: new Set([indiceLote]) });
      }
    }
  });

  return [...grupos.values()]
    .map(({ patron, lotes }) => ({ ...patron, evidencia: lotes.size }))
    .sort((a, b) => b.evidencia - a.evidencia || a.patron.localeCompare(b.patron));
}

/**
 * Los patrones que respalda más de un lote. Con un solo lote no hay
 * corroboración posible, así que todo pasa.
 */
export function patronesCorroborados(
  patrones: PatronConsolidado[],
  totalLotes: number,
  minimo = 2
): PatronConsolidado[] {
  if (totalLotes < 2) return patrones;
  return patrones.filter((patron) => patron.evidencia >= minimo);
}

const TITULOS_CATEGORIA: Record<CategoriaPatron, string> = {
  ganchos: "Ganchos que se repiten",
  mecanismos: "Mecanismos únicos",
  secuencias_de_prueba: "Cómo se construye la prueba",
  objeciones: "Objeciones y cómo se responden",
  beats: "Estructura beat a beat",
  lexico: "Léxico del avatar",
};

/**
 * Arma el documento de doctrina del vertical que va a la biblioteca por rubro
 * (Bloque 1.5 del contexto de generación).
 */
export function renderDoctrina(args: {
  industria: string;
  formato: string;
  patrones: PatronConsolidado[];
  totalDocumentos: number;
  totalLotes: number;
}): string {
  const secciones = CATEGORIAS_PATRON.map((categoria) => {
    const delGrupo = args.patrones.filter((patron) => patron.categoria === categoria);
    if (!delGrupo.length) return "";
    const items = delGrupo
      .map((patron) => `- **${patron.patron}** _(en ${patron.evidencia} de ${args.totalLotes} lotes)_\n  Ejemplo: ${patron.ejemplo}`)
      .join("\n");
    return `## ${TITULOS_CATEGORIA[categoria]}\n\n${items}`;
  }).filter(Boolean);

  return [
    `# Anatomía del ${args.formato.toUpperCase()} de ${args.industria}`,
    "",
    `Destilado de ${args.totalDocumentos} guiones del rubro. Cada patrón indica en cuántos lotes independientes apareció: cuanto más alto, más consistente es la señal.`,
    "",
    ...secciones,
  ].join("\n");
}
