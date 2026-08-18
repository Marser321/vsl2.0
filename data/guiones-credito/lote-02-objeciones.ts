/**
 * Lote 2 — objeciones y frenos.
 *
 * El corpus ataca bien "¿esto es una estafa?" y "ya lo intenté solo", pero deja
 * fuera los frenos que más aparecen en consulta: creer que el caso no tiene
 * arreglo, el miedo a empeorarlo, la falta de tiempo y la duda sobre si se
 * puede sin número de seguro social.
 */
import type { VarianteGuion } from "./tipos";

export const LOTE_02: VarianteGuion[] = [
  {
    slug: "no-tiene-arreglo",
    titulo: "Reel · «Mi crédito ya no tiene arreglo»",
    formato: "reel",
    duracionSeg: 42,
    plataforma: "reels",
    angulo: "Objeción de resignación — el freno más común y menos atacado",
    contenido: `# «Mi crédito ya no tiene arreglo»

## Gancho (0:00–0:09)
> [VISUAL: Cara a cámara, tono de desafío amable.]
> [TEXTO EN PANTALLA: "«Ya no tiene arreglo»"]
Me escriben esto todas las semanas: «lo mío ya no tiene arreglo». Y casi siempre es la creencia más cara que cargan.

## El reencuadre (0:09–0:20)
> [VISUAL: Tono directo, gesticulando.]
Tu reporte no es una sentencia. Es un archivo. Y los archivos tienen errores, tienen fechas que vencen, y tienen información que alguien tiene que poder probar.

## Desarrollo (0:20–0:34)
> [VISUAL: Tres columnas simples: "lo que se corrige", "lo que caduca", "lo que se construye".]
> [TEXTO EN PANTALLA: "Tres caminos distintos"]
Hay cosas que se corrigen porque están mal. Hay cosas que caducan solas con el tiempo. Y hay historial que se construye desde cero. Son tres caminos y casi nadie te explica cuál es el tuyo.

## Cierre (0:34–0:39)
> [VISUAL: Cara a cámara, tono cercano.]
Lo que no tiene arreglo es el reporte que nadie miró nunca.

## CTA (0:39–0:42)
> [TEXTO EN PANTALLA: "AUDITORÍA GRATIS ⬇"]
Agenda la tuya y salimos de la suposición.`,
  },

  {
    slug: "miedo-empeorar",
    titulo: "Reel · «¿Y si lo muevo y lo empeoro?»",
    formato: "reel",
    duracionSeg: 38,
    plataforma: "tiktok",
    angulo: "Miedo a empeorar — parálisis por desinformación",
    contenido: `# «¿Y si lo muevo y lo empeoro?»

## Gancho (0:00–0:08)
> [VISUAL: Cara a cámara, tono de entender el miedo.]
> [TEXTO EN PANTALLA: "«Mejor no toco nada»"]
«Mejor no toco nada, no sea que lo empeore». Entiendo el miedo. Y te voy a explicar de dónde sale.

## El origen del miedo (0:08–0:20)
> [VISUAL: Gráfico: una mano cerrando tarjetas, el puntaje bajando.]
Sale de que la gente hace movimientos a ciegas: cierra tarjetas viejas, abre cuentas nuevas de golpe, paga cuentas en cobro sin entender qué pasa después. Eso sí puede empeorarlo.

## El giro (0:20–0:34)
> [VISUAL: Modo solución, tono firme.]
> [TEXTO EN PANTALLA: "Revisar no mueve nada"]
Pero mirar tu propio reporte no baja tu puntaje. Revisar es gratis y es neutro. Lo que cambia las cosas es lo que decides después, y eso se decide con el reporte a la vista.

## CTA (0:34–0:38)
> [TEXTO EN PANTALLA: "MIRA ANTES DE MOVER ⬇"]
Mira antes de mover. Agenda tu revisión gratis abajo.`,
  },

  {
    slug: "sin-ssn-itin",
    titulo: "Reel · «¿Se puede si no tengo número de seguro social?»",
    formato: "reel",
    duracionSeg: 42,
    plataforma: "reels",
    angulo: "ITIN / sin SSN — pregunta central del avatar latino, sin cubrir",
    contenido: `# «¿Se puede si no tengo número de seguro social?»

## Gancho (0:00–0:07)
> [VISUAL: Cara a cámara, tono directo y respetuoso.]
> [TEXTO EN PANTALLA: "La pregunta que más me hacen"]
Es la pregunta que más me llega por mensaje privado, y casi nadie la contesta en video.

## Respuesta honesta (0:07–0:18)
> [VISUAL: Tono de claridad, sin rodeos.]
Sí se puede construir historial de crédito con ITIN. Hay bancos y cooperativas que abren cuentas y productos de crédito con ese número. No todos, pero existen.

## La aclaración (0:18–0:32)
> [VISUAL: Texto sobreimpreso.]
> [TEXTO EN PANTALLA: "Lo que sí importa revisar"]
Lo importante es revisar primero si ya existe un archivo a tu nombre. Mucha gente asume que no tiene reporte y resulta que sí lo tiene, con información vieja o con cuentas que no reconoce.

## Cierre (0:32–0:38)
> [VISUAL: Cara a cámara, cercano.]
Empezar sin saber qué hay ya escrito sobre ti es empezar dos pasos atrás.

## CTA (0:38–0:42)
> [TEXTO EN PANTALLA: "ESCRIBE ITIN ⬇"]
Escribe ITIN y te digo cómo revisarlo en tu caso.`,
  },

  {
    slug: "no-tengo-tiempo",
    titulo: "Reel · «No tengo tiempo para esto»",
    formato: "reel",
    duracionSeg: 32,
    plataforma: "shorts",
    angulo: "Objeción de tiempo — la más silenciosa",
    contenido: `# «No tengo tiempo para esto»

## Gancho (0:00–0:08)
> [VISUAL: Cara a cámara, tono comprensivo pero directo.]
> [TEXTO EN PANTALLA: "«No tengo tiempo»"]
«No tengo tiempo para eso ahora». Y es verdad: trabajas doble turno. Por eso mismo te lo digo así de corto.

## El contraste (0:08–0:22)
> [VISUAL: Reloj simple en pantalla, luego una factura.]
> [TEXTO EN PANTALLA: "20 minutos vs. años de sobreprecio"]
La revisión inicial toma menos de lo que tardas en almorzar. Lo que cuesta tiempo de verdad es seguir pagando intereses más altos en el carro, en la tarjeta y en el seguro durante años.

## El reencuadre (0:22–0:30)
> [VISUAL: Tono firme, cara a cámara.]
No te estoy pidiendo que aprendas el sistema. Te estoy pidiendo veinte minutos para que alguien te diga dónde estás parado.

## CTA (0:30–0:32)
> [TEXTO EN PANTALLA: "20 MINUTOS ⬇"]
Agenda esos veinte minutos abajo.`,
  },

  {
    slug: "pague-y-no-subio",
    titulo: "Reel · Pagaste la deuda y el puntaje no se movió",
    formato: "reel",
    duracionSeg: 37,
    plataforma: "reels",
    angulo: "Frustración post-pago — enorme y solo tocada de refilón",
    contenido: `# Pagaste la deuda y el puntaje no se movió

## Gancho (0:00–0:06)
> [VISUAL: Confirmación de pago en el teléfono, luego un puntaje que sigue igual.]
> [TEXTO EN PANTALLA: "Pagaste. Y nada."]
Juntaste el dinero. Pagaste la cuenta en cobro. Y tu puntaje se quedó exactamente donde estaba.

## La explicación (0:06–0:16)
> [VISUAL: Cara a cámara, tono de explicar sin condescender.]
Pagar una cuenta en cobro no la borra del reporte. La marca cambia a «pagada», pero la cuenta sigue ahí, y sigue pesando en tu historial.

## El matiz (0:16–0:30)
> [VISUAL: Texto sobreimpreso, tono de precisión.]
> [TEXTO EN PANTALLA: "Pagar ≠ corregir"]
Pagar y corregir son dos cosas distintas. Pagar cierra la deuda. Corregir es otra pregunta: ¿esa cuenta está bien reportada, con el monto correcto, la fecha correcta, y alguien puede probar que es tuya?

## CTA (0:30–0:37)
> [VISUAL: Modo solución.]
> [TEXTO EN PANTALLA: "REVISA ANTES DE PAGAR ⬇"]
Si estás por pagar una cuenta vieja, revisa antes qué dice el reporte. Agenda tu auditoría gratis.`,
  },
];
