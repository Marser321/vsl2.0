import { getDb } from "./index";
import { frameworks, settings } from "./schema";

const PROMPT_MAESTRO = `Sos un copy chief senior especializado en VSL (Video Sales Letters) de respuesta directa para audiencia hispanohablante, con foco en el público latino de Estados Unidos. Trabajás para AD Media Solution, una agencia de marketing digital, y escribís guiones que venden.

## Tu estándar de calidad

- **El gancho lo es todo.** Los primeros 15-30 segundos deciden si el espectador se queda. Abrí con curiosidad, dolor específico o una afirmación contraintuitiva — nunca con presentaciones ("Hola, mi nombre es...") ni con contexto innecesario.
- **Escribí para el oído, no para el ojo.** El guion se lee en voz alta: frases cortas, ritmo conversacional, palabras simples. Nada de jerga corporativa ni frases que un locutor trabaría al leer.
- **Español neutro** por defecto, pensado para el público latino de EE. UU. (voseo o localismo regional solo si el brief lo pide). Natural, directo, emocional.
- **Especificidad vende.** Números concretos, escenas visualizables, ejemplos con nombre y apellido. "Perdió 8 kilos en 6 semanas" > "logró grandes resultados".
- **Una idea por bloque.** Cada sección del guion empuja UNA emoción o UN argumento. Si un párrafo hace dos cosas, partilo.
- **El CTA no es un apéndice.** Preparalo emocionalmente antes de pedirlo, hacelo específico (qué hacer, qué pasa después, por qué ahora).
- **Manejo de objeciones integrado.** Las objeciones del brief se responden dentro de la narrativa (historia, prueba, garantía), no en una lista al final.

## Formato de salida

Devolvé el guion en Markdown con esta estructura:
- Título del guion como H1.
- Cada sección/beat del framework como H2 con el nombre del beat y su duración estimada, ej.: \`## Gancho (0:00–0:25)\`.
- Debajo de cada H2, el texto EXACTO a locutar (sin acotaciones de cámara salvo que el brief las pida).
- Donde haya una instrucción de edición/visual imprescindible, usá blockquote: \`> [VISUAL: ...]\`.
- Calculá las duraciones asumiendo ~150 palabras por minuto en español.
- Respetá la duración objetivo del brief (±10%).

## Cómo usar el material de contexto

- Los **guiones ganadores** adjuntos son tu vara de calidad: imitá su estructura, ritmo e intensidad — no su contenido literal.
- Los **briefs y documentos del cliente** son la fuente de verdad sobre producto, audiencia y oferta. No inventes claims que no estén respaldados por el material.
- Los **aprendizajes** (learnings) son reglas acumuladas de la agencia: aplicalos siempre.
- Si el material del cliente contradice el brief puntual de esta generación, priorizá el brief y señalalo en una nota al final.

Entregá SOLO el guion (con el formato de arriba). Sin preámbulos ni explicaciones del proceso.`;

const FRAMEWORKS: Array<{
  name: string;
  slug: string;
  description: string;
  structureMd: string;
}> = [
  {
    name: "VSL Clásico (Respuesta Directa)",
    slug: "vsl-clasico",
    description:
      "La estructura probada de VSL largo: gancho, historia, mecanismo, oferta, cierre. Ideal para productos de ticket medio/alto.",
    structureMd: `1. **Gancho** (5-10% del tiempo): promesa grande + curiosidad. Interrumpe el patrón.
2. **Identificación del problema**: describir el dolor con tanta precisión que el espectador piense "me está hablando a mí".
3. **Agitación**: el costo de no resolverlo (emocional, económico, de tiempo). Qué pasa si sigue igual.
4. **Historia + descubrimiento**: la historia del origen (del fundador, de un cliente) que lleva al descubrimiento del mecanismo.
5. **Mecanismo único**: POR QUÉ esto funciona cuando lo demás falló. La razón creíble y diferente.
6. **Prueba**: testimonios, datos, demostración. Específicos y creíbles.
7. **Presentación de la oferta**: qué incluye, valor percibido, precio, bonos.
8. **Manejo de objeciones + garantía**: revertir el riesgo.
9. **Cierre con urgencia/escasez real** + CTA claro y repetido.`,
  },
  {
    name: "PAS (Problema–Agitación–Solución)",
    slug: "pas",
    description:
      "Directo y emocional. Ideal para VSLs cortos (2-5 min) y audiencias conscientes del problema.",
    structureMd: `1. **Problema**: nombrar el problema exacto del avatar en sus propias palabras.
2. **Agitación**: profundizar el dolor — consecuencias, frustraciones acumuladas, soluciones que ya fallaron.
3. **Solución**: presentar el producto como el puente. Mecanismo breve + prueba + oferta + CTA.`,
  },
  {
    name: "AIDA (Atención–Interés–Deseo–Acción)",
    slug: "aida",
    description:
      "El clásico de publicidad adaptado a video. Versátil para casi cualquier producto y duración.",
    structureMd: `1. **Atención**: gancho visual/verbal fuerte en los primeros 5 segundos.
2. **Interés**: dato, historia o pregunta que engancha con el mundo del espectador.
3. **Deseo**: beneficios pintados como escenas de la vida futura + prueba social.
4. **Acción**: CTA único, específico, con razón para actuar ahora.`,
  },
  {
    name: "Star–Story–Solution",
    slug: "star-story-solution",
    description:
      "Narrativo, centrado en un protagonista. Ideal para nichos de transformación personal (salud, dinero, relaciones).",
    structureMd: `1. **Star**: presentar al protagonista (cliente o fundador) — alguien como el espectador.
2. **Story**: su historia de lucha: el fondo del pozo, los intentos fallidos, el punto de quiebre y el descubrimiento.
3. **Solution**: cómo el mecanismo/producto transformó su vida, prueba de que es replicable, oferta y CTA.`,
  },
  {
    name: "4 Ps (Promise–Picture–Proof–Push)",
    slug: "cuatro-ps",
    description:
      "Compacto y de alta conversión para VSLs de 3-8 minutos con oferta directa.",
    structureMd: `1. **Promise**: la promesa central, grande pero creíble, en la primera frase.
2. **Picture**: pintar la vida del espectador CON el resultado ya logrado (escenas concretas).
3. **Proof**: por qué creerlo — mecanismo, testimonios, datos, autoridad.
4. **Push**: la oferta + urgencia + CTA sin ambigüedad.`,
  },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  default_provider: "openrouter",
  default_model_openrouter: "openrouter/ensemble-5+1",
  system_prompt: PROMPT_MAESTRO,
  wpm_es: "150",
  context_token_budget: "150000",
};

async function seed() {
  const db = getDb();
  for (const fw of FRAMEWORKS) {
    await db.insert(frameworks)
      .values({ ...fw, isBuiltin: true })
      .onConflictDoUpdate({
        target: frameworks.slug,
        set: {
          name: fw.name,
          description: fw.description,
          structureMd: fw.structureMd,
        },
      });
  }

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await db.insert(settings).values({ key, value }).onConflictDoNothing();
  }

  console.log(
    `Seed OK: ${FRAMEWORKS.length} frameworks, ${Object.keys(DEFAULT_SETTINGS).length} settings.`
  );
}

seed();
