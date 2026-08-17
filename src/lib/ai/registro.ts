/**
 * Normalización de voseo rioplatense a tuteo neutro.
 *
 * Por qué existe: el prompt puede pedir español neutro con toda claridad y aun
 * así los guiones largos derivan al voseo. Los modelos gratuitos del arnés
 * arrastran mucho español rioplatense de su entrenamiento, y cuanto más texto
 * generan, más pesa ese sesgo frente a la instrucción — los reels de 30
 * segundos salen limpios y los VSL de 6 minutos no. Limpiar los prompts era
 * necesario, pero no alcanza para textos largos.
 *
 * Esta es la red determinista: una transformación de código, no una súplica al
 * modelo. No sustituye a los prompts en tuteo (menos voseo generado = menos
 * texto que tocar), los complementa.
 *
 * Lo que NO hace: cambiar el registro de un guion que el brief pidió en voseo
 * a propósito. El llamador decide cuándo aplicarla.
 */

/** Letras que cuentan como parte de una palabra, con acentos y ñ. */
const LETRA = "A-Za-zÀ-ÿ";

/**
 * Verbos con diptongación en la raíz: el voseo la pierde y el tuteo la
 * recupera. Una regla puramente morfológica produciría "pensas" en vez de
 * "piensas", así que estos van por diccionario.
 */
const IRREGULARES: Record<string, string> = {
  // presente de indicativo
  pensás: "piensas", perdés: "pierdes", querés: "quieres", tenés: "tienes",
  podés: "puedes", dormís: "duermes", empezás: "empiezas", entendés: "entiendes",
  volvés: "vuelves", contás: "cuentas", encontrás: "encuentras", recordás: "recuerdas",
  probás: "pruebas", mostrás: "muestras", cerrás: "cierras", comenzás: "comienzas",
  jugás: "juegas", sentís: "sientes", mentís: "mientes", seguís: "sigues",
  conseguís: "consigues", segís: "sigues", pedís: "pides", servís: "sirves", venís: "vienes",
  decís: "dices", vas: "vas", sos: "eres", estás: "estás", vos: "tú",
  // imperativos con diptongación o irregulares
  pensá: "piensa", perdé: "pierde", queré: "quiere", tené: "ten",
  podé: "puede", dormí: "duerme", empezá: "empieza", entendé: "entiende",
  volvé: "vuelve", contá: "cuenta", encontrá: "encuentra", recordá: "recuerda",
  probá: "prueba", mostrá: "muestra", cerrá: "cierra", comenzá: "comienza",
  sentí: "siente", seguí: "sigue", conseguí: "consigue", pedí: "pide",
  vení: "ven", decí: "di", hacé: "haz", poné: "pon", salí: "sal",
  andá: "anda", vení_: "ven", sé: "sé",
};

/** Enclíticos: el acento del voseo se mueve al reescribir en tuteo. */
const ENCLITICOS: Record<string, string> = {
  hacelo: "hazlo", hacela: "hazla", hacelos: "hazlos", hacelas: "hazlas",
  usalo: "úsalo", usala: "úsala", usalos: "úsalos", usalas: "úsalas",
  dejalo: "déjalo", dejala: "déjala", miralo: "míralo", mirala: "mírala",
  contalo: "cuéntalo", contala: "cuéntala", tomalo: "tómalo", tomala: "tómala",
  guardalo: "guárdalo", guardala: "guárdala", aplicalo: "aplícalo", aplicalos: "aplícalos",
  preparalo: "prepáralo", preparala: "prepárala", partilo: "pártelo", partila: "pártela",
  señalalo: "señálalo", validala: "válidala", quebrala: "quiébrala", reemplazala: "reemplázala",
  presentalas: "preséntalas", cumplilo: "cúmplelo", elegilo: "elígelo", escribilo: "escríbelo",
  fijate: "fíjate", acordate: "acuérdate", enterate: "entérate", quedate: "quédate",
  llevatelo: "llévatelo", anotalo: "anótalo", probalo: "pruébalo", mandalo: "mándalo",
};

/**
 * Palabras que terminan igual que una forma voseante pero no lo son. Sin esta
 * lista, "inglés" o "después" se romperían.
 */
const PROTEGIDAS = new Set([
  "inglés", "francés", "después", "además", "través", "interés", "estrés", "mes", "país",
  "raíz", "maíz", "jamás", "atrás", "detrás", "quizás", "más", "demás", "también", "según",
  "así", "aquí", "ahí", "allí", "sí", "él", "útil", "fácil", "difícil", "será", "está",
  "están", "acá", "allá", "mamá", "papá", "sofá", "café", "menú", "bebé", "qué", "porqué",
  "estás", "vas", "das", "ves", "es", "les", "res", "tres", "revés", "mientras", "gas",
  // Subjuntivos del tuteo: "que tú estés", "que tú seas". No son voseo.
  "estés", "esté", "seás", "sé", "dé", "vés",
]);

/**
 * Formas en -í y -é que son ambiguas de verdad: en los verbos terminados en
 * -ir, el pretérito de primera persona y el imperativo voseante coinciden
 * ("subí" es "yo subí" y también "vos subí"). Sin análisis sintáctico no hay
 * forma de decidir, así que no se tocan y se reportan para revisión humana.
 */
const AMBIGUO = new RegExp(`(?<![${LETRA}])([${LETRA}]{3,}(?:í|é))(?![${LETRA}])`, "gi");

export type ResultadoNormalizacion = {
  texto: string;
  /** Cada reemplazo aplicado, para poder auditar la pasada. */
  cambios: Array<{ de: string; a: string }>;
  /** Formas que parecen voseo pero no se supo convertir con seguridad. */
  sinResolver: string[];
};

/** Aplica la capitalización de `modelo` a `palabra`. */
function conMismaCaja(palabra: string, modelo: string): string {
  if (modelo === modelo.toUpperCase() && modelo.length > 1) return palabra.toUpperCase();
  if (modelo[0] === modelo[0].toUpperCase()) return palabra[0].toUpperCase() + palabra.slice(1);
  return palabra;
}

/**
 * Convierte una forma voseante a tuteo. Devuelve `null` si no es voseo o si no
 * se puede convertir con confianza — en la duda no se toca nada, porque una
 * conversión equivocada es peor que un voseo que el humano ve y corrige.
 */
function convertir(palabra: string): string | null {
  const baja = palabra.toLowerCase();
  if (PROTEGIDAS.has(baja)) return null;

  const directo = IRREGULARES[baja] ?? ENCLITICOS[baja];
  if (directo) return conMismaCaja(directo, palabra);

  // Presente de indicativo regular: -ás/-és/-ís → -as/-es/-es
  //   agendás → agendas · accedés → accedes · abrís → abres
  if (/ás$/.test(baja) && baja.length > 4) return conMismaCaja(baja.slice(0, -2) + "as", palabra);
  if (/és$/.test(baja) && baja.length > 4) return conMismaCaja(baja.slice(0, -2) + "es", palabra);
  if (/ís$/.test(baja) && baja.length > 4) return conMismaCaja(baja.slice(0, -2) + "es", palabra);

  // Imperativo agudo en -á: agendá → agenda. Es inequívoco: ningún pretérito
  // ni presente del tuteo termina en -á.
  if (/á$/.test(baja) && baja.length > 3) return conMismaCaja(baja.slice(0, -1) + "a", palabra);

  // Los que terminan en -í o -é NO se convierten por regla. En los verbos -ir,
  // el pretérito de primera persona y el imperativo voseante son idénticos
  // ("Subí 80 puntos" = yo subí; "Subí el volumen" = vos subí), y en los -ar
  // pasa lo mismo con -é ("probé"). Romper un pretérito correcto es peor que
  // dejar un voseo que el humano ve y corrige, así que estos van por
  // diccionario y el resto se reporta como ambiguo.
  return null;
}

// Flag `i` para que "AGENDÁ" en mayúsculas también entre.
const CANDIDATO = new RegExp(`(?<![${LETRA}])([${LETRA}]{3,}(?:ás|és|ís|á|é|í))(?![${LETRA}])`, "gi");
const ENCLITICO_RE = new RegExp(
  `(?<![${LETRA}])(${Object.keys(ENCLITICOS).join("|")})(?![${LETRA}])`,
  "gi"
);
/** `sos` y `vos` no llevan tilde, así que el patrón general no los alcanza. */
const PRONOMBRE_RE = new RegExp(`(?<![${LETRA}])(sos|vos)(?![${LETRA}])`, "gi");

/**
 * Preposiciones tras las cuales `vos` se traduce como "ti", no como "tú":
 * "lo que guardan sobre vos" → "sobre ti", nunca "sobre tú".
 */
const PREPOSICIONES = new Set([
  "a", "ante", "bajo", "contra", "de", "desde", "en", "entre", "hacia", "hasta",
  "para", "por", "según", "sin", "sobre", "tras", "como",
]);

/**
 * Reescribe un guion de voseo rioplatense a tuteo neutro.
 *
 * Deja intactos los pretéritos de primera persona ("probé", "encontré"), que se
 * escriben igual en los dos registros, y todo lo que no reconoce con confianza.
 */
export function normalizarATuteo(texto: string): ResultadoNormalizacion {
  const cambios: Array<{ de: string; a: string }> = [];
  const sinResolver: string[] = [];

  // Los enclíticos primero: no llevan tilde y el patrón general no los ve.
  let salida = texto.replace(ENCLITICO_RE, (match) => {
    const convertido = conMismaCaja(ENCLITICOS[match.toLowerCase()], match);
    cambios.push({ de: match, a: convertido });
    return convertido;
  });

  salida = salida.replace(PRONOMBRE_RE, (match, _g, offset: number) => {
    let destino: string;
    if (match.toLowerCase() === "sos") {
      destino = "eres";
    } else {
      // La palabra anterior decide: "para vos" → "para ti"; "vos sabes" → "tú".
      const previa = salida.slice(0, offset).trimEnd().split(/[\s(«"']+/).pop()?.toLowerCase() ?? "";
      destino = previa === "con" ? "contigo" : PREPOSICIONES.has(previa) ? "ti" : "tú";
    }
    const convertido = conMismaCaja(destino, match);
    cambios.push({ de: match, a: convertido });
    // "con vos" → "contigo": la preposición se absorbe en el pronombre.
    return convertido;
  });
  salida = salida.replace(new RegExp(`(?<![${LETRA}])con contigo(?![${LETRA}])`, "gi"), (m) =>
    conMismaCaja("contigo", m)
  );

  salida = salida.replace(CANDIDATO, (match) => {
    const convertido = convertir(match);
    if (!convertido) return match;
    if (convertido === match) return match;
    cambios.push({ de: match, a: convertido });
    return convertido;
  });

  // Lo que quedó en -í/-é sin convertir: puede ser voseo o un pretérito
  // legítimo. Se reporta para que un humano lo mire, no se toca.
  for (const m of salida.matchAll(AMBIGUO)) {
    const baja = m[1].toLowerCase();
    if (PROTEGIDAS.has(baja) || IRREGULARES[baja] || ENCLITICOS[baja]) continue;
    if (!sinResolver.includes(baja)) sinResolver.push(baja);
  }

  return { texto: salida, cambios, sinResolver };
}

/** Formas voseantes que quedan en un texto, para auditar. */
export function detectarVoseo(texto: string): string[] {
  const encontradas = new Set<string>();
  for (const m of texto.matchAll(CANDIDATO)) {
    if (convertir(m[1]) !== null) encontradas.add(m[1].toLowerCase());
  }
  for (const m of texto.matchAll(ENCLITICO_RE)) encontradas.add(m[1].toLowerCase());
  for (const m of texto.matchAll(PRONOMBRE_RE)) encontradas.add(m[1].toLowerCase());
  return [...encontradas];
}
