/**
 * Corpus fundacional de la agencia: doctrina destilada de los grandes referentes
 * de respuesta directa (ecuación de valor, VSL clásico, mensaje en 4 partes,
 * gancho-historia-oferta), reglas de oro de VSL, playbook de reels, taxonomía de
 * ganchos y desgloses estructurales — TODO en redacción original (sin transcripts
 * verbatim con copyright).
 *
 * Estos documentos entran como docs globales kind `framework`/`learning` →
 * Bloque 1 cacheado de TODAS las generaciones.
 *
 * Idempotente: cada doc lleva un tag estable `corpus:<slug>`; si ya existe un
 * documento global con ese tag, se saltea (nunca pisa ediciones del usuario).
 *
 * Uso: npm run db:seed-corpus
 */
import { getDb } from "./index";
import { documents, frameworks, templates, type DocumentKind, type ScriptBrief, type ScriptFormat } from "./schema";
import { and, eq, isNull } from "drizzle-orm";
import { estimateTokens } from "../lib/ai/tokens";

type CorpusDoc = {
  slug: string;
  title: string;
  kind: DocumentKind;
  topics: string[];
  text: string;
};

const CORPUS_DOCS: CorpusDoc[] = [
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "oferta-valor",
    title: "Doctrina: Ecuación de valor y oferta irresistible",
    kind: "framework",
    topics: ["oferta", "valor", "garantias"],
    text: `## La ecuación de valor

El valor percibido de cualquier oferta se calcula así:

**Valor = (Resultado soñado × Probabilidad percibida de lograrlo) ÷ (Tiempo hasta el resultado × Esfuerzo y sacrificio)**

Todo guion de venta trabaja las 4 variables:

1. **Resultado soñado (subir):** no describas el producto, describí el estado final en escenas concretas de la vida del avatar. No "un curso de inglés" sino "responder ese mail de la empresa americana sin pasarlo por el traductor".
2. **Probabilidad percibida (subir):** prueba, mecanismo creíble, testimonios de gente PARECIDA al avatar, garantía. La frase interna que hay que producir: "esto le funcionó a alguien como yo, me puede funcionar a mí".
3. **Tiempo hasta el resultado (bajar):** mostrá el primer resultado visible lo antes posible ("tu primer X en 7 días"), aunque el resultado completo tarde. La gente compra velocidad hacia la primera señal de progreso.
4. **Esfuerzo y sacrificio (bajar):** "hecho para vos" > "hecho con vos" > "hacelo vos". Cada componente que reduce trabajo del cliente (plantillas, acompañamiento, automatización) vale más que contenido adicional.

Regla: los amateurs solo inflan el numerador (prometen más). Los profesionales atacan el denominador (más rápido, más fácil) porque ahí vive la diferenciación creíble.

## Construcción del stack de oferta

1. Listá TODOS los problemas que el avatar encuentra antes, durante y después de usar la solución núcleo.
2. Convertí cada problema en una solución con nombre propio ("Calculadora de precios lista para usar" — no "bonus #3").
3. Asigná a cada pieza un valor en dinero justificable y presentalas apiladas: el precio final debe verse como una fracción obvia del valor total.
4. Cada bono existe para matar UNA objeción específica. Si no mata una objeción, no va.

## Garantías (reversión de riesgo)

- **Incondicional** ("si no te gusta, te devuelvo todo"): máxima conversión, usala cuando el producto es sólido.
- **Condicional** ("si aplicás X y no lográs Y, te devuelvo el doble"): más fuerte aún si la condición es razonable; filtra curiosos.
- **Anti-garantía** ("todas las ventas son finales, y este es el porqué"): para ofertas premium donde el compromiso es parte del posicionamiento.
- La garantía se presenta INMEDIATAMENTE después del precio, nunca antes.

## Escasez y urgencia legítimas

Solo escasez real: cupos con razón operativa, cohortes con fecha, precio que sube en fecha anunciada, bonos que expiran. La urgencia falsa destruye la confianza y es detectable. Si no hay escasez real, creá una razón real (capacidad de onboarding, edición limitada) antes de escribir el guion.

## Nombre de la oferta

Fórmula: [Resultado específico] + [plazo o contenedor] + [para avatar]. "Sistema de Primeros 10 Clientes en 60 Días para diseñadoras freelance" vende más que "Mentoría Premium". El nombre es la promesa comprimida.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "vsl-clasico-doctrina",
    title: "Doctrina: Fórmula clásica del VSL largo",
    kind: "framework",
    topics: ["vsl", "estructura"],
    text: `## El principio rector: la pendiente resbaladiza

Cada frase tiene UN trabajo: lograr que se escuche la siguiente. Un VSL no es un documento informativo, es una pendiente: si en algún punto el espectador puede bajarse sin perder nada, se baja. Auditá cada bloque preguntando "¿qué pierde el que se va acá?" — si la respuesta es "nada", falta un loop abierto.

## Apertura

- Prohibido: logos, presentaciones ("hola, soy…"), "en este video vas a ver…", contexto previo.
- La primera frase ES el gancho: una promesa específica, una afirmación contraintuitiva o una escena de dolor reconocible. La segunda frase intensifica la primera. Recién hacia el minuto 1-2 podés presentarte, y solo con la credencial mínima que el avatar necesita.

## Micro-compromisos (escalera de síes)

Encadenà afirmaciones que el avatar YA cree ("si tenés un negocio local, dependés de que te recomienden… y las recomendaciones no se pueden controlar…") antes de introducir la idea nueva. Cada "sí" mental baja la resistencia al siguiente. La venta grande se construye con acuerdos chicos.

## Loops abiertos

Prometé algo concreto para más adelante ("en un minuto te muestro el error #1, pero antes…") y CUMPLILO. Dos o tres loops activos sostienen un VSL largo. Un loop que no se cierra genera desconfianza.

## El mecanismo único

Antes de presentar el producto, respondé: "¿por qué todo lo que probé antes falló?" (culpa externa: le mintieron, el método estaba incompleto — nunca culpa del avatar) y "¿por qué ESTO sí funciona?" (el mecanismo con nombre propio). Sin mecanismo único, el producto es un commodity y compite por precio.

## Coreografía del precio

1. No mencionar precio ni producto hasta haber construido valor completo (en un VSL largo, recién en el 60-75% del tiempo).
2. Anclar alto: costo del problema sin resolver, costo de las alternativas (agencia, consultor, años de prueba y error), valor sumado del stack.
3. Revelar el precio real como contraste ("no son los $X que cobra una agencia por mes… es menos que Y por día").
4. Inmediatamente después: garantía, y después de la garantía, el CTA.
5. Nunca te disculpes por el precio ni lo justifiques con tus costos: se justifica con el valor del resultado.

## Ritmo y re-enganche

Cada 60-90 segundos, un cambio de energía: pregunta directa al espectador, mini-historia, dato duro, cambio de escena visual. El oído se acostumbra y se duerme; el patrón roto despierta.

## Cierre

El CTA se repite 2-3 veces con ángulos distintos: el lógico (recap de valor), el emocional (la escena de la vida con el problema resuelto), el de urgencia (qué pierde si lo deja para después). Después del último CTA, cortá. Todo lo que sigue diluye.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "mensaje-4-partes",
    title: "Doctrina: Mensaje de venta en 4 partes",
    kind: "framework",
    topics: ["vsl", "estructura", "trafico-frio"],
    text: `## El mensaje que detiene el scroll (pensado para tráfico frío)

Estructura de 4 partes, en este orden exacto:

### 1. Llamar al avatar (sin nombrarlo burdo)

El avatar tiene que saber en 3 segundos que esto es PARA ÉL. Las formas elegantes: abrir con su dolor exacto en sus palabras ("si cada fin de mes mirás la facturación y no sabés de dónde va a salir el próximo cliente…"), con su identidad ("los que vendemos servicios sabemos que…") o con su situación ("tenés un local, hacés buen trabajo, y aun así el de la otra cuadra está lleno"). La forma burda ("¡Atención dueños de negocios!") solo para reels de respuesta directa donde la velocidad importa más que la elegancia.

### 2. Promesa grande + intriga (el "cómo raro")

Una promesa específica y dimensionada + un mecanismo que suene NUEVO: "cómo conseguir 15 reuniones de venta por mes sin publicar contenido todos los días — con un sistema que funciona mientras dormís". La intriga está en el "sin X" (elimina el sacrificio que el avatar odia) y en el mecanismo con nombre. Si la promesa se puede decir de cualquier competidor, no es promesa, es ruido.

### 3. Prueba apilada

Orden de poder: **demostración en vivo > resultados con números y nombres > testimonios en video > testimonios en texto > lógica del mecanismo > autoridad/credenciales**. Usá al menos 3 capas. La prueba no es una sección: se riega por todo el guion, una capa cada 60-90 segundos. Regla de especificidad: "Mariana pasó de 2 a 11 clientes en 90 días" > "cientos de alumnos lograron resultados".

### 4. Oferta imposible de ignorar + CTA

La oferta se presenta como decisión asimétrica: todo el valor del stack + garantía que absorbe el riesgo vs. seguir exactamente igual. El CTA dice QUÉ hacer, QUÉ pasa inmediatamente después ("agendás, te llega un video de 5 minutos, llegás a la llamada con tu diagnóstico hecho") y POR QUÉ ahora. La fricción desconocida mata más ventas que el precio: describir el paso siguiente sube conversión.

## Principio de valor por adelantado

Antes de pedir, el guion tiene que DAR algo: un reencuadre que el avatar no tenía, un error que puede corregir hoy, un dato que cambia cómo ve su problema. El espectador tiene que sentir que ya ganó algo por mirar — eso compra la atención para la venta.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "gancho-historia-oferta",
    title: "Doctrina: Gancho–Historia–Oferta y el puente de epifanía",
    kind: "framework",
    topics: ["storytelling", "creencias"],
    text: `## La unidad mínima de venta: Gancho → Historia → Oferta

Todo mensaje de venta, de un reel de 30 segundos a un VSL de 40 minutos, tiene los mismos tres órganos: el **gancho** captura atención, la **historia** cambia una creencia, la **oferta** canaliza la creencia nueva hacia una acción. Cuando un guion no convierte, diagnosticá en ese orden: ¿nadie lo mira? → gancho. ¿Lo miran y no desean? → historia. ¿Desean y no compran? → oferta.

## Vendés creencias, no productos

El avatar no compra el producto: compra la creencia de que ESTE vehículo lo lleva a SU resultado. Antes de escribir, definí:

- **La falsa creencia dominante**: la idea que hoy le impide comprar ("necesito más seguidores para vender", "sin inglés no puedo cobrar en dólares").
- **La creencia nueva**: la que hace la compra inevitable ("con 1.000 seguidores correctos facturás más que con 100.000 curiosos").

El guion existe para derribar la primera e instalar la segunda. El producto aparece recién cuando la creencia nueva ya está instalada.

## El puente de epifanía (cómo se cambia una creencia)

No se cambia con argumentos: se cambia con una historia que le permite al avatar llegar SOLO a la conclusión. Beats del puente:

1. **Backstory**: el protagonista (fundador o cliente) en el mismo lugar donde está hoy el avatar — mismo dolor, mismas creencias.
2. **El muro**: intentó lo obvio (lo que el avatar está intentando ahora) y falló. Esto valida al avatar: no es tonto, el método era el problema.
3. **La epifanía**: el momento concreto del descubrimiento — un mentor, un dato, un accidente. Cuanto más específica la escena, más creíble.
4. **El plan**: qué hizo distinto (el mecanismo, contado simple).
5. **El conflicto interno**: dudó, casi abandona — sin esto la historia es propaganda.
6. **El logro + transformación**: resultados medibles Y quién es ahora (identidad, no solo números).

## Las tres familias de creencias a derribar

1. **Del vehículo**: "esto no funciona" → la historia principal.
2. **Internas**: "funciona, pero yo no puedo" (no tengo talento/disciplina) → testimonio de alguien MENOS capacitado que el avatar.
3. **Externas**: "yo puedo, pero mi situación no" (tiempo, plata, país) → testimonio de alguien con la MISMA restricción.

Un VSL largo derriba las tres, cada una con su mini-historia. Un reel derriba UNA.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "reglas-oro-vsl",
    title: "Reglas de oro del VSL que convierte",
    kind: "learning",
    topics: ["vsl", "calidad"],
    text: `Reglas operativas no negociables para todo guion de VSL. Aplicar SIEMPRE:

1. **Los primeros 30 segundos deciden todo.** Sin logos, sin "hola soy", sin "en este video". Primera frase = promesa, dolor o contradicción. Si el gancho se puede poner en el video de un competidor, es genérico: reescribir.
2. **Una idea por bloque.** Cada sección empuja UNA emoción o UN argumento. Bloque que hace dos cosas = dos bloques.
3. **Prueba cada 60-90 segundos.** Testimonio, número, demostración o lógica del mecanismo. Claim sin capa de prueba cerca = claim que resta.
4. **Especificidad o muerte.** "8 kilos en 6 semanas" > "grandes resultados". "347 clientes" > "cientos de clientes". Todo número redondo despierta sospecha; los números precisos suenan a verdad.
5. **Escribir para el oído.** El guion se locuta: frases cortas, palabras de uso diario, cero jerga corporativa. Test: leerlo en voz alta; donde el locutor traba, reescribir. Puntuar para la respiración.
6. **Loops abiertos que se cierran.** Prometer algo para más adelante sostiene la atención — pero todo loop abierto SE CIERRA dentro del guion.
7. **El CTA se prepara antes de pedirse.** Primero la escena del futuro con el problema resuelto, después el pedido. En VSL de 5+ minutos el CTA se repite 2-3 veces con ángulo distinto (lógico, emocional, urgencia).
8. **Objeciones dentro de la narrativa.** Se responden con historia, prueba o garantía integradas — nunca como lista de FAQ dentro del guion locutado.
9. **Beneficios como escenas, no como lista.** No "incluye 12 módulos": "el martes a la noche abrís el módulo 2 y armás tu primera campaña mientras cenás".
10. **El villano correcto.** El enemigo del guion nunca es el avatar (no "no te esforzaste"): es el método viejo, la industria que le mintió, la información incompleta.
11. **Duración disciplinada.** ~150 palabras por minuto en español. Respetar la duración del brief ±10%. Si sobra contenido, cortar argumentos débiles enteros — no comprimir todos un poco.
12. **Prohibidas las frases de relleno de IA:** "en el mundo actual", "en la era digital", "no es solo X, es Y", "descubrí el poder de", "llevá tu negocio al siguiente nivel", "la solución definitiva". Si una frase podría abrir cualquier video de cualquier nicho, se borra.
13. **El final corta seco.** Último CTA → fin. Sin resúmenes, sin despedidas largas, sin "gracias por ver".`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "playbook-reels",
    title: "Playbook de reels verticales (15–90 segundos)",
    kind: "learning",
    topics: ["reel", "vertical", "retencion"],
    text: `Doctrina para guiones de video vertical corto (TikTok / Instagram Reels / YouTube Shorts). El reel compite contra el scroll: cada segundo se gana.

## Estructura en 3 actos

- **Gancho (0:00–0:03):** el espectador decide en menos de 2 segundos. El gancho es TRIPLE y simultáneo: lo que se DICE (primera frase completa, sin "hola"), lo que se VE (movimiento, resultado, situación en curso — nunca alguien acomodándose para hablar) y lo que se LEE (texto en pantalla que reformula, no repite, lo dicho).
- **Desarrollo (0:03 – ~80% del total):** UNA sola idea. Entregar en pasos o razones cortas; cada 2-3 segundos algo cambia (corte, zoom, texto nuevo, b-roll). Sin introducciones ni contexto: se empieza por el medio de la acción.
- **Payoff + CTA (último 15-20%):** la recompensa prometida por el gancho + un CTA nativo. Si el payoff decepciona, el usuario no vuelve a confiar en un gancho de esa cuenta.

## Reglas de retención

1. **Cambio visual cada 1.5–3 segundos.** No hace falta cambiar de escena: zoom in, texto que aparece, corte de eje, b-roll.
2. **Diseñar para sonido apagado.** Subtítulos SIEMPRE. El texto en pantalla cuenta la historia solo. Safe zones: nada importante en el 12% superior ni el 20% inferior (lo tapa la UI de la app).
3. **Ritmo hablado: ~2.5 palabras por segundo.** Un reel de 30s = ~75 palabras locutadas. Escribir de más es el error #1: guion de 30s con 120 palabras = locución apurada e ininteligible.
4. **Cortar TODA palabra que no trabaja.** En un reel no hay transiciones ("bueno", "entonces", "como les decía") — cada frase arranca en el verbo o en el dato.
5. **Loop:** si la última frase conecta con la primera, el video se re-reproduce y el algoritmo lo premia ("…y por eso nunca empieces por ahí" → vuelve al gancho).
6. **Un reel = una idea.** Si hay dos ideas, son dos reels. La serie gana al video enciclopédico.

## CTA nativo por plataforma

- **Awareness/orgánico:** CTA de interacción ("guardalo para cuando…", "comentá X y te mando…", "seguime que mañana muestro…"). El CTA de venta dura agresivo mata el alcance orgánico.
- **Ads/retargeting:** CTA directo sin vergüenza ("tocá el botón y…"), oferta clara, urgencia real.
- Duraciones típicas por objetivo: awareness 15-30s, educación/consideración 30-60s, conversión directa 20-45s.

## Formato de guion de reel

Por beat: rango de segundos + locución exacta + [VISUAL: …] + [TEXTO EN PANTALLA: …]. El editor tiene que poder filmar/montar sin preguntar nada.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "taxonomia-ganchos",
    title: "Taxonomía de ganchos: los 10 ángulos y cuándo usar cada uno",
    kind: "learning",
    topics: ["ganchos", "aperturas"],
    text: `Los 10 ángulos de gancho de la agencia (usar estos nombres exactos). Para cada uno: plantilla, ejemplo genérico y cuándo conviene.

1. **curiosidad** — Abrir un vacío de información que duele no cerrar. Plantilla: "El [elemento inesperado] que [resultado deseado] — y que casi nadie en [nicho] conoce". Ej.: "La pregunta de 10 segundos que me ahorró $40.000 en publicidad". Usar con: audiencias frías o saturadas de promesas directas. Riesgo: si el payoff no está a la altura, se percibe clickbait.
2. **dolor** — Nombrar el dolor exacto en las palabras del avatar. Plantilla: "Si [situación dolorosa específica], esto es para vos". Ej.: "Si publicás todos los días y las ventas siguen igual, escuchá esto". Usar con: avatar consciente del problema. El dolor específico filtra mejor que la promesa amplia.
3. **contrarian** — Contradecir una creencia establecida del nicho. Plantilla: "[Consejo popular] es exactamente por qué [problema persiste]". Ej.: "Publicar más contenido es la razón por la que vendés menos". Usar con: mercados sofisticados que ya escucharon todo. Riesgo: la contradicción se sostiene con el mecanismo, si no, es provocación vacía.
4. **prueba social** — Abrir con el resultado de un tercero verificable. Plantilla: "[Persona como el avatar] logró [resultado específico] en [plazo] — así". Ej.: "Una nutricionista de Montevideo llenó su agenda de octubre en 12 días". Usar con: avatar escéptico que ya conoce las promesas del nicho.
5. **pregunta** — Pregunta que el avatar no puede no responderse. Plantilla: "¿Sabés cuánto te cuesta cada mes [problema oculto]?". Ej.: "¿Cuántos clientes perdiste este mes por responder tarde?". Usar con: problemas latentes o invisibles que hay que activar. La pregunta retórica floja ("¿querés ganar más?") está prohibida.
6. **historia** — Entrar en el medio de una escena concreta. Plantilla: "[Momento específico], y en ese momento [giro]". Ej.: "Eran las 2 de la mañana y estaba borrando la página de mi negocio". Usar con: tráfico frío, nichos de transformación personal, VSL largo. El mejor gancho para bajar defensas: nadie se resiste a una historia empezada.
7. **estadística** — Un número que reencuadra el problema. Plantilla: "El [%] de [grupo] [dato contraintuitivo] — y la razón no es la que pensás". Ej.: "9 de cada 10 locales gastronómicos no llegan al año 3". Usar con: nichos B2B, audiencias analíticas, o para dar autoridad instantánea. El dato tiene que ser específico y defendible.
8. **urgencia** — La ventana de acción se cierra. Plantilla: "Si [contexto temporal real], tenés [plazo] para [acción] antes de que [consecuencia]". Ej.: "Si vendés por Instagram, tenés hasta marzo antes de que este cambio te saque del feed". Usar con: eventos reales (cambios de plataforma, temporada, regulación). Urgencia inventada = confianza destruida.
9. **identificación** — Espejo de identidad: el avatar se ve descripto. Plantilla: "Los que [hábito/situación del avatar] sabemos que [verdad compartida]". Ej.: "Los que trabajamos solos sabemos que el problema no es la motivación: es que nadie te exige". Usar con: comunidades con identidad fuerte (freelancers, madres, dueños de X). Genera el "me está hablando a mí" más rápido que el dolor.
10. **promesa directa** — El resultado, el plazo y el método en una frase. Plantilla: "[Resultado] en [plazo] con [mecanismo], sin [sacrificio odiado]". Ej.: "Tu agenda llena en 30 días con un solo video bien distribuido, sin bailar en TikTok". Usar con: retargeting, avatar caliente que ya te conoce, ofertas fuertes. En tráfico frío compite con todos los que prometen lo mismo.

**Regla de selección:** cuanto más frío el tráfico y más sofisticado el mercado → curiosidad, historia, contrarian, identificación. Cuanto más caliente el avatar → promesa directa, urgencia, prueba social. Ante la duda, testear ángulos opuestos (un emocional vs. un racional), no dos variantes del mismo ángulo.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "objeciones-precio",
    title: "Manejo de objeciones y presentación de precio",
    kind: "learning",
    topics: ["objeciones", "precio", "cierre"],
    text: `## Las 6 objeciones universales y su tratamiento

Toda audiencia tiene estas 6. El brief aporta las específicas; estas se tratan SIEMPRE, integradas en la narrativa (nunca como FAQ locutada):

1. **"No tengo tiempo"** → Reencuadre: el método actual es lo que le roba tiempo. Mostrar el costo en horas del statu quo y el diseño "para gente sin tiempo" del producto (plantillas, duración de las lecciones, implementación mínima viable). Se trata DENTRO de la descripción del mecanismo.
2. **"No tengo plata"** → Nunca discutir la plata: cambiar la categoría mental de gasto a inversión con matemática simple ("un cliente nuevo paga el programa entero"). Comparar contra el costo real de la alternativa (agencia, empleado, otro año igual). Se trata junto al precio.
3. **"No te creo / ya me estafaron"** → No defenderse: darle la razón ("tenés razón en desconfiar, este rubro está lleno de humo") y diferenciarse con mecanismo + prueba verificable + garantía. La validación de la desconfianza ES la técnica.
4. **"A mí no me va a funcionar / mi caso es distinto"** → Testimonio espejo: alguien con la MISMA restricción que el avatar (misma edad, mismo nicho, mismo país, menos recursos). Un testimonio espejo vale por diez genéricos.
5. **"Ya probé algo parecido"** → El culpable es el método viejo, no el avatar: "no falló por vos, falló porque [pieza que faltaba]". Este reencuadre es obligatorio antes de presentar el mecanismo.
6. **"Lo dejo para después"** → El costo de esperar, calculado: qué pierde por mes en plata, avance o tranquilidad + escasez real si existe. Es la objeción final: se trata en el cierre, nunca antes.

## Coreografía del precio (orden exacto)

1. **Stack completo primero:** cada componente con su valor individual justificado.
2. **Ancla externa:** lo que costaría resolverlo por otra vía ("una agencia te cobra $X por mes", "un año más de prueba y error vale $Y").
3. **Revelación por contraste:** el precio real contra el ancla. Pausa. Sin disculpas, sin "sé que es caro", sin justificarlo con costos propios.
4. **Reducción al absurdo:** precio dividido por día o comparado con un gasto trivial equivalente ("menos que un delivery por semana").
5. **Garantía inmediatamente después del precio:** el momento de máxima tensión es el momento de absorber el riesgo.
6. **Bonos por urgencia (si existen):** después de la garantía, con expiración real.
7. **CTA.**

## Errores que matan la venta

- Precio antes de valor completo (la mente compara contra $0).
- Múltiples opciones de compra en un VSL (una decisión, no un menú; máximo 2 planes si el brief lo exige).
- Responder objeciones que la audiencia no tiene (las infla).
- Garantía escondida o mencionada al pasar: es un activo protagónico, no letra chica.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "niveles-conciencia",
    title: "Niveles de conciencia y sofisticación del mercado",
    kind: "learning",
    topics: ["audiencia", "posicionamiento"],
    text: `Antes de escribir una palabra, ubicar al avatar en DOS ejes. Definen el gancho, la duración y cuánto hay que educar.

## Eje 1 — Nivel de conciencia (¿cuánto sabe de su problema y de la solución?)

1. **Inconsciente:** no registra el problema. Lead: historia o identificación — entrar por la vida, no por el producto. Guiones largos, educativos. (El más caro de convertir: evitarlo salvo mercado virgen.)
2. **Consciente del problema:** le duele pero no sabe que hay solución. Lead: dolor + agitación → esperanza. El gancho nombra SU síntoma exacto; el guion presenta que existe salida antes de presentar cuál.
3. **Consciente de la solución:** sabe que existen soluciones, no conoce el producto. Lead: mecanismo + diferenciación ("por qué esto funciona cuando lo demás no"). Acá vive la MAYORÍA de las campañas.
4. **Consciente del producto:** conoce el producto, no se decidió. Lead: prueba + oferta + garantía. Retargeting clásico: menos historia, más razones y reversión de riesgo.
5. **Totalmente consciente:** solo espera la razón para comprar HOY. Lead: promesa directa + urgencia + oferta. Guiones cortos, reels de conversión, lanzamientos.

Regla: **cuanto menos consciente, más largo el camino narrativo y más indirecto el gancho.** Un error de nivel = guion que "no conecta" aunque esté bien escrito.

## Eje 2 — Sofisticación del mercado (¿cuántas promesas parecidas ya escuchó?)

- **Etapa 1-2 (mercado nuevo):** la promesa directa alcanza ("perdé peso"). Casi no existe hoy.
- **Etapa 3 (promesas quemadas):** se compite con MECANISMO: "perdé peso CON [método distinto]". El "cómo nuevo" es el mensaje.
- **Etapa 4 (mecanismos quemados):** mecanismo mejorado y específico: "la versión 2.0 de [mecanismo], que corrige por qué el original fallaba".
- **Etapa 5 (saturación total):** ya no se compite por promesa: se compite por IDENTIFICACIÓN e identidad ("este es el sistema de los que odian X") o por experiencia nueva. El gancho contrarian y el de identificación brillan acá.

## Aplicación al brief

- Tráfico frío + mercado saturado (el caso más común hoy): gancho de curiosidad/historia/contrarian, mecanismo con nombre propio, prueba espejo abundante.
- Si el brief no especifica temperatura del tráfico: asumir frío para VSL y preguntarse qué reel/ad vio ANTES el espectador para llegar acá.
- La sofisticación se lee en los ads de la competencia: si tres competidores prometen lo mismo, subir un nivel (mecanismo → identidad).`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "desglose-vsl-highticket",
    title: "Desglose estructural: VSL largo de infoproducto high-ticket (20–35 min)",
    kind: "learning",
    topics: ["desglose", "vsl", "high-ticket"],
    text: `Anatomía beat a beat del patrón dominante en VSLs de infoproductos/mentorías de ticket alto (patrón estructural recurrente en los VSLs ganadores del género, redactado como doctrina original). Porcentajes sobre duración total.

- **0–3% | Gancho apilado:** promesa dimensionada + credencial mínima + primer loop ("al final te muestro exactamente cómo, pero antes…"). En los mejores: la promesa incluye al escéptico ("aunque ya hayas probado X").
- **3–8% | Contrato de visualización:** qué va a recibir por quedarse (agenda del video, en beneficio, no en temas) + descalificación honesta ("esto NO es para vos si…"). La descalificación sube el valor percibido y la calidad del lead.
- **8–18% | Historia de origen:** puente de epifanía completo del fundador — mismo pozo que el avatar, intentos fallidos con los métodos que el avatar está considerando ahora, epifanía concreta. Se cierra con la primera prueba propia (resultado del fundador).
- **18–45% | Demolición de creencias (el corazón):** las 3 falsas creencias (vehículo, interna, externa), cada una con el ciclo: enunciar la creencia en las palabras del avatar → validarla ("es lógico que pienses eso porque…") → quebrarla con historia/dato → reemplazarla → prueba espejo (testimonio de alguien definido por ESA objeción). Acá vive la mayor parte del tiempo y de la conversión.
- **45–55% | El mecanismo con nombre:** el sistema presentado como framework propio (3-5 pasos con nombres memorables). El nombre convierte información en propiedad intelectual.
- **55–60% | Transición con permiso ("permission to sell"):** "¿te interesaría que te acompañe a implementarlo?" — pregunta puente que convierte la clase en oferta sin fricción.
- **60–78% | Stack de oferta:** componente por componente: qué es → qué problema elimina → valor individual. Bonos que matan objeciones puntuales. Valor total recapitulado.
- **78–85% | Precio coreografiado:** ancla (valor total, costo de alternativas) → revelación → reducción al absurdo → garantía condicional detallada como compromiso mutuo.
- **85–100% | Cierre en tres pasadas:** CTA lógico (recap de la matemática) → CTA emocional (la escena de su vida en 6 meses, con y sin acción) → CTA de urgencia (cierre de cohorte/bonos, con razón operativa real). FAQ locutada SOLO si el embudo no tiene página de FAQ. Corte seco tras el último CTA.

**Por qué funciona:** la venta ocurre en la demolición de creencias (18-45%), no en la oferta; el que llega al minuto de la oferta ya decidió y solo busca confirmación. Error común a evitar: comprimir la demolición para llegar antes a la oferta — invierte la lógica del formato.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "desglose-vsl-corto-dtc",
    title: "Desglose estructural: VSL corto de ecommerce/DTC (60–120 seg)",
    kind: "learning",
    topics: ["desglose", "vsl", "ecommerce"],
    text: `Anatomía del video ad largo de producto físico/DTC que domina en Meta (patrón estructural recurrente de los ads ganadores del formato, redactado como doctrina original). Timing sobre un total de 90s, escala proporcional.

- **0:00–0:04 | Gancho de problema + interrupción visual:** el problema mostrado (no contado) en la escena más reconocible: la crema que no absorbe, la espalda que duele al levantarse. Locución: dolor o contrarian ("dejá de comprar X: el problema nunca fue Y").
- **0:04–0:15 | Agitación con identificación:** 2-3 escenas rápidas de los intentos fallidos típicos ("probaste A, B, y lo de siempre: nada"). El espectador tiene que tildar mentalmente "sí, sí, sí". Cada solución fallida nombrada = un competidor descartado.
- **0:15–0:40 | Héroe + mecanismo demostrado:** entra el producto EN USO (nunca packshot estático primero). El mecanismo en una frase simple + demo visual del diferencial ("mirá lo que pasa cuando…"). Si hay un momento "wow" visual, va acá y se repite variado 2 veces.
- **0:40–0:55 | Ráfaga de prueba social:** 2-3 testimonios de una frase (texto en pantalla + cara real), un número agregado ("+12.000 clientas"), estrellas/reviews. Velocidad > profundidad: es una ráfaga, no una sección.
- **0:55–1:15 | Oferta + reversión de riesgo:** el deal concreto (descuento/bundle/envío) con razón ("por lanzamiento de temporada"), garantía simple en lenguaje simple ("lo usás 30 días; si no te convence, te devolvemos todo").
- **1:15–1:30 | CTA doble:** CTA directo ("tocá el botón y elegí tu color") + urgencia real (stock, fin de promo) + última escena del resultado (la vida CON el producto). Cierre en el beneficio, no en el logo.

**Reglas del formato:** cambio visual cada 2-3s durante TODO el video; subtítulos siempre; el guion debe funcionar sin audio; primera mención de marca recién en el beat del héroe (0:15+) — antes de eso, el video es del problema, no de la marca. Error común: abrir con el producto y la marca — regala el skip.`,
  },
  // ────────────────────────────────────────────────────────────────────────────
  {
    slug: "desglose-reel-conversion",
    title: "Desglose estructural: reel de conversión (30–45 seg)",
    kind: "learning",
    topics: ["desglose", "reel"],
    text: `Anatomía segundo a segundo del reel de respuesta directa que lleva tráfico a un VSL, una landing o DM (patrón estructural recurrente de los reels ganadores del género, redactado como doctrina original). Base: 40 segundos ≈ 100 palabras locutadas.

- **0:00–0:02 | Triple gancho:** locución arranca EN la primera sílaba del video (sin respiro previo). VISUAL: acción en curso o resultado a la vista. TEXTO EN PANTALLA: reformulación del gancho con las palabras clave en color. Los tres canales dicen lo mismo con palabras distintas.
- **0:02–0:06 | Sub-gancho de retención:** la promesa de lo que viene si se queda ("te muestro las 3 en 30 segundos, la última es la que nadie hace"). El "índice comprimido" + loop del ítem final es el patrón de retención más robusto del formato.
- **0:06–0:30 | Entrega en bloques de 6-8 segundos:** cada bloque = un paso/razón/error con su propio micro-gancho numerado ("La primera:…", "Ahora la que importa:…"). VISUAL cambia por bloque; TEXTO EN PANTALLA lleva el número y la keyword. El bloque más fuerte SIEMPRE al final (cumple el loop del sub-gancho).
- **0:30–0:36 | Puente de valor a oferta:** la línea que convierte el tip en insuficiencia productiva: "esto te ordena, pero lo que mueve la aguja es [lo que está del otro lado del click]". Sin este puente, el reel educa y no convierte; con puente burdo, huele a venta desde el segundo 1. La forma: el contenido resuelve el QUÉ, el destino resuelve el CÓMO.
- **0:36–0:42 | CTA específico + loop:** una sola acción, dicha en forma nativa ("comentá GUÍA y te la mando", "el link está en la bio, entrá que…") + última frase que reconecta con el gancho para cerrar el loop de re-reproducción.

**Métricas mentales al escribir:** si el gancho no retiene, nada más importa (el 60-70% del resultado es el primer bloque); cada bloque del desarrollo debe sobrevivir la pregunta "¿alguien se va acá?"; el CTA por comentario (palabra clave) rinde mejor en orgánico, el de link directo en ads. Error común: gastar los primeros 5 segundos en contexto ("hola chicos, hoy les traigo") — el reel muerto más común del mundo.`,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Frameworks de REEL (estructuras cortas verticales), upsert por slug.
// ──────────────────────────────────────────────────────────────────────────────

const REEL_FRAMEWORKS: Array<{
  name: string;
  slug: string;
  description: string;
  structureMd: string;
}> = [
  {
    name: "Reel: Gancho–Desarrollo–Payoff",
    slug: "reel-hook-desarrollo-payoff",
    description:
      "La estructura base del reel de valor/conversión (20-60s). Un gancho triple, una sola idea desarrollada en bloques, payoff que cumple y CTA nativo.",
    structureMd: `1. **Gancho triple (0:00–0:03):** locución + visual + texto en pantalla, simultáneos. Sin saludos ni contexto.
2. **Sub-gancho (0:03–0:06):** qué gana si se queda ("te muestro X en 30 segundos, lo último es lo mejor").
3. **Desarrollo (0:06 – ~80%):** UNA idea en bloques de 6-8s, cada bloque con micro-gancho numerado y cambio visual. Lo más fuerte al final.
4. **Payoff (últimos ~20%):** cumplir exactamente lo prometido en el gancho.
5. **CTA nativo + loop:** una sola acción; la última frase reconecta con la primera.`,
  },
  {
    name: "Reel: UGC / Testimonio a cámara",
    slug: "reel-ugc-testimonio",
    description:
      "Estilo usuario real hablando a cámara (30-60s). El formato de mayor confianza para producto/servicio; ideal para ads que no parecen ads.",
    structureMd: `1. **Apertura en resultado o frustración (0:00–0:03):** "no puedo creer que esto me haya funcionado" / "estaba a punto de rendirme con X".
2. **El problema personal (0:03–0:12):** su situación antes, con detalles cotidianos creíbles (nunca perfectos).
3. **El descubrimiento (0:12–0:20):** cómo llegó al producto, incluida la duda inicial ("pensé que era humo, pero…").
4. **El resultado específico (0:20–0:35):** qué cambió, con números o escenas ("en 3 semanas ya…"). Mostrar el producto EN USO.
5. **Recomendación + CTA suave (0:35–0:45):** "si estás como yo estaba, [acción]". Tono de consejo a un amigo, no de vendedor.`,
  },
  {
    name: "Reel: Lista (N errores / razones / señales)",
    slug: "reel-lista",
    description:
      "El formato de retención más predecible (30-60s): lista numerada con el mejor ítem al final. Ideal para educar y posicionar autoridad.",
    structureMd: `1. **Gancho numerado (0:00–0:03):** "Los 3 errores que [consecuencia] — el tercero lo comete todo el mundo".
2. **Ítems en bloques de 5-10s:** cada uno con número en pantalla, enunciado + una frase de por qué importa. Ritmo parejo, sin desarrollar de más.
3. **El ítem final es el mejor (anunciarlo así en el gancho):** sostiene la retención hasta el final.
4. **Cierre (últimos 5-8s):** micro-conclusión que une los ítems + CTA (guardar/comentar/seguir o link según objetivo).`,
  },
  {
    name: "Reel: POV / Situación identificable",
    slug: "reel-pov",
    description:
      "Escena en segunda persona con texto narrador (15-40s). Máxima identificación con mínima locución; ideal para awareness y nichos con identidad fuerte.",
    structureMd: `1. **Situación reconocible (0:00–0:03):** "POV: son las 11 de la noche y seguís contestando mensajes de clientes". El TEXTO EN PANTALLA es el narrador principal.
2. **Desarrollo de la escena (0:03–0:20):** la secuencia emocional que el avatar vive (frustración → deseo), contada en 2-4 pantallas de texto sobre b-roll/actuación mínima.
3. **El giro (0:20–0:30):** aparece la alternativa/el después ("hasta que automatizaste las respuestas…").
4. **Cierre + CTA liviano (0:30–0:40):** identidad compartida ("los que ya lo hicimos no volvemos atrás") + seguir/comentar/link.`,
  },
  {
    name: "Reel: Oferta directa",
    slug: "reel-oferta-directa",
    description:
      "Respuesta directa pura (15-30s) para retargeting o audiencia caliente: promesa, prueba mínima, oferta y CTA sin vueltas.",
    structureMd: `1. **Promesa directa (0:00–0:03):** resultado + plazo + sin el sacrificio odiado ("[Resultado] en [plazo], sin [X]").
2. **Prueba en una frase (0:03–0:08):** un número, un testimonio de una línea o una demo ultrarrápida.
3. **La oferta concreta (0:08–0:18):** qué recibe + el deal (descuento/bono/garantía) + razón de la urgencia real.
4. **CTA doble (0:18–0:25):** la acción exacta ("tocá el botón / comentá X") repetida con la urgencia. Cierre en el beneficio, no en el logo.`,
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Plantillas builtin: esqueletos con {{TOKENS}} (se resuelven con datos del
// cliente) y bloques [GUÍA] por beat. Skip-if-exists por slug (no pisa ediciones).
// ──────────────────────────────────────────────────────────────────────────────

const TEMPLATES: Array<{
  slug: string;
  title: string;
  format: ScriptFormat;
  frameworkSlug: string | null;
  description: string;
  briefDefaults: Partial<ScriptBrief>;
  contentMd: string;
}> = [
  {
    slug: "vsl-clasica-5min",
    title: "VSL clásica de 5 minutos",
    format: "vsl",
    frameworkSlug: "vsl-clasico",
    description:
      "La estructura completa de respuesta directa en formato compacto: gancho, dolor, mecanismo, prueba, oferta y doble CTA.",
    briefDefaults: { duracionMin: 5 },
    contentMd: `# VSL — {{PRODUCTO}} para {{AUDIENCIA}}

## Gancho (0:00–0:25)
> [GUÍA: elegí UN ángulo — dolor, curiosidad o contrarian. Sin saludos, sin logos: la primera frase ya vende la permanencia.]

Si {{DOLOR}}, lo que vas a escuchar en los próximos minutos te va a cambiar la forma de verlo.

Y no, no es lo que ya probaste. Quedate hasta el final porque te voy a mostrar exactamente cómo funciona — y por qué esta vez sí.

## El problema real (0:25–1:10)
> [GUÍA: describí el dolor con detalles cotidianos que el avatar reconozca como propios. Terminá con la validación: no es su culpa, el método era el problema.]

Seguro te pasa esto: {{DOLOR}}. Y ya intentaste resolverlo — {{OTRAS_SOLUCIONES_FALLIDAS}}.

La verdad es que nada de eso funciona por una razón muy simple que nadie te dijo: {{RAZON_DEL_FRACASO}}.

## El descubrimiento y el mecanismo (1:10–2:20)
> [GUÍA: mini historia de origen (fundador o cliente) → epifanía → el mecanismo con nombre propio. El "porqué funciona" en lenguaje simple.]

{{HISTORIA_DE_ORIGEN}}

Ahí nació {{NOMBRE_DEL_METODO}}: {{EXPLICACION_SIMPLE_DEL_MECANISMO}}.

## Prueba (2:20–3:10)
> [GUÍA: 2-3 capas de prueba, la más fuerte primero. Números concretos, nombres, plazos. Un testimonio espejo del avatar.]

{{PRUEBA_1_RESULTADO_CON_NUMEROS}}

{{PRUEBA_2_TESTIMONIO_ESPEJO}}

## La oferta (3:10–4:15)
> [GUÍA: stack completo → ancla de precio → precio real → garantía inmediatamente después. Sin disculpas por el precio.]

Esto es todo lo que te llevás con {{PRODUCTO}}: {{OFERTA}}.

> [VISUAL: stack de la oferta en pantalla, componente por componente]

Hacerlo por tu cuenta te costaría {{ANCLA_DE_PRECIO}}. Hoy accedés por {{PRECIO}}.

Y lo hacés sin riesgo: {{GARANTIA}}.

## Cierre y CTA (4:15–5:00)
> [GUÍA: CTA doble — lógico primero, emocional después. Describí el paso siguiente exacto. Cortá seco tras el último CTA.]

{{CTA}}. Hacés clic, {{QUE_PASA_DESPUES}}, y empezás hoy mismo.

Podés cerrar este video y seguir como hasta ahora — o podés ser la persona que en {{PLAZO}} mira para atrás y agradece haber empezado hoy. {{CTA}}.`,
  },
  {
    slug: "vsl-webinar-15min",
    title: "VSL estilo webinar de 15 minutos",
    format: "vsl",
    frameworkSlug: "star-story-solution",
    description:
      "Formato educativo-narrativo para ticket alto: historia de transformación, demolición de 3 creencias y transición con permiso a la oferta.",
    briefDefaults: { duracionMin: 15 },
    contentMd: `# Masterclass — {{PRODUCTO}}

## Gancho + contrato (0:00–1:00)
> [GUÍA: promesa dimensionada + qué se lleva por quedarse + descalificación honesta ("esto NO es para..."). El primer loop: prometé revelar el método completo hacia el final.]

En los próximos minutos te voy a mostrar cómo {{PROMESA_PRINCIPAL}} — aunque {{OBJECION_PRINCIPAL}}.

Esto no es para cualquiera: si buscás {{ATAJO_FALSO}}, cerrá el video. Pero si {{IDENTIDAD_DEL_AVATAR}}, esto te sirve.

## La historia (1:00–4:00)
> [GUÍA: puente de epifanía completo — mismo pozo que el avatar, intentos fallidos, el muro, la epifanía concreta, el plan. Incluí el conflicto interno: sin duda no hay historia creíble.]

{{HISTORIA_COMPLETA_DE_TRANSFORMACION}}

## Creencia falsa #1: el vehículo (4:00–7:00)
> [GUÍA: "para lograr X necesitás Y" — la creencia que frena la compra. Validala, quebrala con datos/historia, reemplazala. Cerrá con prueba espejo.]

Seguro pensás que {{CREENCIA_FALSA_1}}. Es lógico — {{VALIDACION}}. Pero mirá esto: {{QUIEBRE_CON_EVIDENCIA}}.

## Creencia falsa #2: interna (7:00–9:30)
> [GUÍA: "yo no puedo porque..." — respondela con el testimonio de alguien MENOS preparado que el avatar.]

{{CREENCIA_INTERNA_Y_QUIEBRE}}

## Creencia falsa #3: externa (9:30–11:30)
> [GUÍA: "no tengo tiempo/plata/mi caso es distinto" — testimonio con la MISMA restricción.]

{{CREENCIA_EXTERNA_Y_QUIEBRE}}

## El método con nombre (11:30–12:30)
> [GUÍA: el sistema en 3-5 pasos con nombres memorables. Es el payoff del loop del gancho.]

{{NOMBRE_DEL_METODO}}: {{PASOS_DEL_METODO}}

## Transición con permiso + oferta (12:30–14:00)
> [GUÍA: pregunta puente ("¿querés que te acompañe a implementarlo?") → stack → ancla → precio → garantía.]

{{OFERTA}}

{{PRECIO_Y_GARANTIA}}

## Cierre en tres pasadas (14:00–15:00)
> [GUÍA: CTA lógico (la matemática), CTA emocional (la escena a 6 meses), CTA de urgencia (razón operativa real). Corte seco.]

{{CTA}}`,
  },
  {
    slug: "reel-ugc-30s",
    title: "Reel UGC / testimonio de 30 segundos",
    format: "reel",
    frameworkSlug: "reel-ugc-testimonio",
    description:
      "Hablado a cámara estilo usuario real: problema → descubrimiento con escepticismo → resultado con números → recomendación de amigo.",
    briefDefaults: { duracionMin: 1, duracionSeg: 30 },
    contentMd: `# Reel UGC — {{PRODUCTO}}

## Gancho (0:00–0:03)
> [VISUAL: cara a cámara, luz natural, en medio de una acción cotidiana — nunca "acomodándose" para hablar]
> [TEXTO EN PANTALLA: no puedo creer que ESTO funcionó]

No puedo creer que esto me haya funcionado — y mirá que yo era de las que no creen en nada.

## El problema (0:03–0:10)
> [VISUAL: b-roll del problema en la vida real]
> [GUÍA: el "antes" con un detalle cotidiano imperfecto que dé credibilidad]

Yo estaba igual que vos: {{DOLOR}}. Probé de todo y nada.

## El descubrimiento (0:10–0:17)
> [VISUAL: unboxing / primera vez usando {{PRODUCTO}}]
> [TEXTO EN PANTALLA: le di una chance 👀]

Hasta que encontré {{PRODUCTO}}. Te juro que pensé que era humo… pero lo probé igual.

## El resultado (0:17–0:25)
> [VISUAL: el después, mostrado no contado]
> [TEXTO EN PANTALLA: {{RESULTADO_EN_3_PALABRAS}}]

{{RESULTADO_CON_NUMERO_O_PLAZO}}. En serio. {{DETALLE_INESPERADO_DEL_RESULTADO}}.

## Recomendación + CTA (0:25–0:30)
> [VISUAL: cara a cámara, tono de amiga]
> [TEXTO EN PANTALLA: {{CTA}}]

Si estás como yo estaba, {{CTA}}. Después me contás.`,
  },
  {
    slug: "reel-autoridad-45s",
    title: "Reel de autoridad: lista de 45 segundos",
    format: "reel",
    frameworkSlug: "reel-lista",
    description:
      "Los N errores/razones/señales del nicho, con el mejor ítem al final. Educa, posiciona autoridad y alimenta la retención.",
    briefDefaults: { duracionMin: 1, duracionSeg: 45 },
    contentMd: `# Reel — 3 errores de {{AUDIENCIA}}

## Gancho numerado (0:00–0:04)
> [VISUAL: a cámara, energía alta, o texto grande sobre b-roll potente]
> [TEXTO EN PANTALLA: 3 errores que te cuestan {{COSTO}}]

Estos son los 3 errores por los que {{DOLOR}} — y el tercero lo comete casi todo el mundo.

## Error #1 (0:04–0:14)
> [VISUAL: cambio de plano o zoom; número 1 grande en pantalla]
> [GUÍA: el error más común, enunciado + por qué duele en una frase]

Primero: {{ERROR_1}}. {{POR_QUE_DUELE_1}}.

## Error #2 (0:14–0:24)
> [VISUAL: cambio de plano; número 2 en pantalla]

Segundo: {{ERROR_2}}. {{POR_QUE_DUELE_2}}.

## Error #3 — el importante (0:24–0:37)
> [VISUAL: acercamiento, ritmo más lento — señal de que llega lo prometido]
> [TEXTO EN PANTALLA: el que comete TODO el mundo]

Y el tercero, el que nadie ve: {{ERROR_3_EL_MEJOR}}. {{EXPLICACION_BREVE}}.

## Cierre + CTA (0:37–0:45)
> [VISUAL: a cámara]
> [TEXTO EN PANTALLA: {{CTA}}]

Si te viste en alguno, {{CTA}} — y guardate este video para no repetirlos.`,
  },
  {
    slug: "reel-oferta-20s",
    title: "Reel de oferta directa de 20 segundos",
    format: "reel",
    frameworkSlug: "reel-oferta-directa",
    description:
      "Respuesta directa pura para retargeting o audiencia caliente: promesa, prueba en una frase, oferta y CTA doble. Sin vueltas.",
    briefDefaults: { duracionMin: 1, duracionSeg: 20 },
    contentMd: `# Reel oferta — {{PRODUCTO}}

## Promesa directa (0:00–0:03)
> [VISUAL: el resultado a la vista desde el frame 1]
> [TEXTO EN PANTALLA: {{PROMESA_EN_5_PALABRAS}}]

{{PROMESA_DIRECTA_CON_PLAZO}} — sin {{SACRIFICIO_ODIADO}}.

## Prueba en una frase (0:03–0:07)
> [VISUAL: testimonio en texto, número grande o demo veloz]

{{PRUEBA_EN_UNA_FRASE}}.

## La oferta (0:07–0:15)
> [VISUAL: el producto/servicio + el deal en pantalla]
> [TEXTO EN PANTALLA: {{OFERTA_EN_POCAS_PALABRAS}}]

{{OFERTA}}. Y con garantía: {{GARANTIA_SIMPLE}}.

## CTA doble (0:15–0:20)
> [VISUAL: flecha/gesto al botón o link]
> [TEXTO EN PANTALLA: {{CTA}} ⬇️]

{{CTA}} ahora — {{URGENCIA_REAL}}. De nuevo: {{CTA}}.`,
  },
];

async function seedCorpus() {
  const db = getDb();

  // Una sola consulta de docs globales; el match por tag se hace en JS.
  const existingGlobals = await db
    .select({ id: documents.id, tags: documents.tags })
    .from(documents)
    .where(and(isNull(documents.clientId), eq(documents.visibility, "global")));

  let inserted = 0;
  let skipped = 0;
  for (const doc of CORPUS_DOCS) {
    const slugTag = `corpus:${doc.slug}`;
    if (existingGlobals.some((d) => d.tags.includes(slugTag))) {
      console.log(`  · skip (ya existe): ${doc.title}`);
      skipped++;
      continue;
    }
    const tokenCount = estimateTokens(doc.text);
    await db.insert(documents).values({
      clientId: null,
      visibility: "global",
      title: doc.title,
      kind: doc.kind,
      extractedText: doc.text,
      tokenCount,
      language: "es",
      tags: [slugTag, "corpus-v1", ...doc.topics],
      isActive: true,
    });
    console.log(`  ✓ ${doc.title} (~${tokenCount} tokens)`);
    inserted++;
  }

  for (const fw of REEL_FRAMEWORKS) {
    await db
      .insert(frameworks)
      .values({ ...fw, format: "reel", isBuiltin: true })
      .onConflictDoUpdate({
        target: frameworks.slug,
        set: {
          name: fw.name,
          description: fw.description,
          structureMd: fw.structureMd,
          format: "reel",
        },
      });
  }

  // Plantillas builtin: skip-if-exists por slug (para no pisar ediciones del usuario).
  const allFrameworks = await db
    .select({ id: frameworks.id, slug: frameworks.slug })
    .from(frameworks);
  const frameworkIdBySlug = new Map(allFrameworks.map((f) => [f.slug, f.id]));
  let templatesInserted = 0;
  for (const t of TEMPLATES) {
    const [row] = await db
      .insert(templates)
      .values({
        slug: t.slug,
        title: t.title,
        format: t.format,
        frameworkId: t.frameworkSlug ? (frameworkIdBySlug.get(t.frameworkSlug) ?? null) : null,
        description: t.description,
        briefDefaults: t.briefDefaults,
        contentMd: t.contentMd,
        isBuiltin: true,
      })
      .onConflictDoNothing({ target: templates.slug })
      .returning({ id: templates.id });
    if (row) templatesInserted++;
  }

  console.log(
    `Corpus OK: ${inserted} docs nuevos, ${skipped} existentes, ${REEL_FRAMEWORKS.length} frameworks de reel (upsert), ${templatesInserted}/${TEMPLATES.length} plantillas nuevas.`
  );
}

seedCorpus();
