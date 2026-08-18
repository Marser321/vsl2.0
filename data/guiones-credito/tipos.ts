/** Una variante de guion escrita a mano para el vertical de crédito. */
export type VarianteGuion = {
  /** Identificador estable: evita duplicar si se re-importa el lote. */
  slug: string;
  titulo: string;
  formato: "vsl" | "reel";
  duracionSeg?: number;
  duracionMin?: number;
  plataforma?: "tiktok" | "reels" | "shorts";
  /** Por qué existe esta variante: qué ángulo cubre que el corpus no tenía. */
  angulo: string;
  /** Markdown con la estructura de beats que espera el sistema. */
  contenido: string;
};
