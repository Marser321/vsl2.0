/**
 * Separación de un guion en locución (lo que se dice frente a cámara) y
 * acotaciones (todo lo demás: dirección visual, texto en pantalla, guías).
 *
 * Por qué existe: hasta ahora la única limpieza del repo vivía dentro de
 * `analyzeScript` en `readtime.ts`, escrita para CONTAR PALABRAS. El
 * teleprompter la reusó como si fuera un renderer, y ahí la diferencia importa:
 * para contar, que sobreviva un `###` o un `Locución:` desvía el total un 1-2%
 * y a nadie le importa; para leer en cámara, cada uno de esos tokens es ruido
 * en el renglón.
 *
 * Los tres consumidores son el teleprompter (mostrar), `analyzeScript` (contar
 * y estimar duración) y el copiado por bloque de la biblioteca.
 */

export type BloqueGuion = {
  /** Título del beat, sin el rango de tiempo: "Gancho". */
  titulo: string;
  /** Rango tal como venía en el encabezado, si lo traía: "0:00–0:03". */
  rango: string | null;
  /** Párrafos a locutar, en orden. */
  locucion: string[];
  /** Acotaciones de producción, sin el marcado que las envolvía. */
  acotaciones: string[];
};

/**
 * Etiquetas de acotación reconocidas dentro de corchetes.
 * `GUIA` aparece mucho en el corpus fundacional y faltaba en la lista que ya
 * existía en `src/lib/ingest/classify.ts`.
 */
export const ETIQUETAS_ACOTACION = [
  "VISUAL",
  "TEXTO EN PANTALLA",
  "EN PANTALLA",
  "B-ROLL",
  "BROLL",
  "GUÍA",
  "GUIA",
  "AUDIO",
  "MÚSICA",
  "MUSICA",
  "NOTA",
] as const;

/** `[VISUAL: ...]`, con o sin blockquote delante. */
const ACOTACION_ETIQUETADA = new RegExp(
  `^\\s*>?\\s*\\[\\s*(?:${ETIQUETAS_ACOTACION.join("|")})\\s*:`,
  "i"
);

/**
 * Prefijos que rotulan la locución en vez de ser locución.
 * `**Locución:**` perdía los asteriscos y quedaba "Locución:" leyéndose en
 * cámara — es exactamente lo que hay que sacar, conservando lo que viene
 * después, que sí se dice.
 */
const PREFIJO_LOCUCION = /^\s*(?:\*\*)?\s*(?:locuci[óo]n|voz en off|vo|narrador[a]?|speaker|locutor[a]?)\s*(?:\*\*)?\s*:\s*/i;

/**
 * Fila de guion tabulado: `0:00–0:08 ⇥ Hook ⇥ texto ⇥ visual`.
 *
 * Es el formato en que llegan los guiones extraídos de los PDF de la agencia,
 * donde la estructura vive en una tabla y no en encabezados markdown. Sin esto
 * un compilado entero queda como un único bloque y no se puede copiar el gancho
 * por separado.
 */
const FILA_TABULADA = /^(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})\s*(?:\t+|\s{2,})?(.*)$/;

/** Encabezado de beat: `## Gancho (0:00–0:03)`. H1 es el título del guion. */
const ENCABEZADO = /^(#{1,6})\s+(.*)$/;
/** El rango de tiempo al final del encabezado: `(0:00–0:03)`. */
const RANGO_FINAL = /\(([^)]*\d[^)]*)\)\s*$/;

/** Saca el marcado de una acotación para mostrarla sin ruido. */
function limpiarAcotacion(linea: string): string {
  return linea
    .replace(/^\s*>\s?/, "")
    .replace(/^\s*\[\s*/, "")
    .replace(/\s*\]\s*$/, "")
    .trim();
}

/**
 * Quita énfasis y código, preservando `_` porque forma parte de marcadores
 * como `{{NOMBRE_DEL_METODO}}` (bug histórico: QA 2026-07-12).
 */
function limpiarEnfasis(texto: string): string {
  return texto.replace(/[*`]/g, "").trim();
}

/**
 * Parte un guion en Markdown en bloques con locución y acotaciones separadas.
 *
 * Todo lo que no sea texto hablado cae en `acotaciones`: blockquotes (con o
 * sin corchetes, de una o varias líneas), encabezados de nivel 3 o más
 * profundo, y las líneas etiquetadas aunque no vengan en blockquote.
 */
export function separarGuion(markdown: string): BloqueGuion[] {
  const bloques: BloqueGuion[] = [];
  let actual: BloqueGuion = { titulo: "Apertura", rango: null, locucion: [], acotaciones: [] };
  let parrafo: string[] = [];
  /** Un blockquote abierto se arrastra hasta que aparece una línea que no lo es. */
  let enBlockquote = false;

  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    const texto = limpiarEnfasis(parrafo.join(" ").replace(/\s+/g, " "));
    if (texto) actual.locucion.push(texto);
    parrafo = [];
  };

  const cerrarBloque = () => {
    cerrarParrafo();
    // Solo se guarda un bloque con contenido: el "Apertura" implícito de antes
    // del primer encabezado no debe aparecer si el guion arranca con uno.
    if (actual.locucion.length || actual.acotaciones.length) bloques.push(actual);
  };

  for (const lineaCruda of markdown.split("\n")) {
    const linea = lineaCruda.trimEnd();

    if (!linea.trim()) {
      cerrarParrafo();
      enBlockquote = false;
      continue;
    }

    const encabezado = linea.match(ENCABEZADO);
    if (encabezado) {
      enBlockquote = false;
      const nivel = encabezado[1].length;
      const crudo = encabezado[2].trim();

      // H1 es el título del guion, no un beat: no abre bloque ni se locuta.
      if (nivel === 1) {
        cerrarParrafo();
        continue;
      }

      // H3+ es subestructura: rotula, no se lee.
      if (nivel >= 3) {
        cerrarParrafo();
        actual.acotaciones.push(limpiarEnfasis(crudo));
        continue;
      }

      cerrarBloque();
      const rango = crudo.match(RANGO_FINAL);
      actual = {
        titulo: limpiarEnfasis(crudo.replace(RANGO_FINAL, "")) || "Sección",
        rango: rango ? rango[1].trim() : null,
        locucion: [],
        acotaciones: [],
      };
      continue;
    }

    // Fila de tabla: abre bloque con su rango y su rótulo.
    const fila = linea.match(FILA_TABULADA);
    if (fila) {
      cerrarBloque();
      const resto = fila[3] ?? "";
      // Columnas de la tabla: [rótulo, qué se dice, visual]. La tercera es
      // acotación, no locución.
      //
      // Límite conocido: cuando el PDF parte una celda en varias líneas, las
      // continuaciones llegan sin tabulación y no hay forma de saber a qué
      // columna pertenecían; se asumen locución, que es la columna larga.
      const campos = resto.split(/\t+/).map((c) => c.trim()).filter(Boolean);
      const [rotulo, dicho, ...visual] = campos.length > 1 ? campos : ["", campos[0] ?? ""];
      actual = {
        titulo: limpiarEnfasis(rotulo) || "Bloque",
        rango: `${fila[1]}–${fila[2]}`,
        locucion: [],
        acotaciones: visual.map((v) => limpiarEnfasis(v)).filter(Boolean),
      };
      if (dicho) parrafo.push(dicho);
      enBlockquote = false;
      continue;
    }

    const esBlockquote = /^\s*>/.test(linea);
    const esEtiquetada = ACOTACION_ETIQUETADA.test(linea);

    if (esBlockquote || esEtiquetada || enBlockquote) {
      cerrarParrafo();
      // Una acotación multilínea sigue abierta mientras no cierre el corchete.
      enBlockquote = esBlockquote || enBlockquote ? !/\]\s*$/.test(linea) : false;
      const texto = limpiarEnfasis(limpiarAcotacion(linea));
      if (texto) actual.acotaciones.push(texto);
      continue;
    }

    // Línea de locución: se le saca el rótulo si lo trae.
    parrafo.push(linea.replace(PREFIJO_LOCUCION, ""));
  }

  cerrarBloque();
  // Un guion vacío o sin nada reconocible igual devuelve un bloque, para que el
  // llamador no tenga que distinguir entre "vacío" y "no hay nada".
  return bloques.length ? bloques : [actual];
}

/** Solo el texto hablado de un guion, listo para leer en cámara. */
export function soloLocucion(markdown: string): string {
  return separarGuion(markdown)
    .flatMap((b) => b.locucion)
    .join("\n\n");
}
