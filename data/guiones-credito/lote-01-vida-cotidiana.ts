/**
 * Variantes de guiones para el vertical de reparación de crédito.
 *
 * Lote 1 — la vida cotidiana más allá de la casa. El corpus existente está
 * saturado en hipoteca, auto y los mitos clásicos; estos ángulos atacan
 * momentos que el latino en EE. UU. vive y que casi nadie conecta con el
 * puntaje: el alquiler negado, el seguro más caro, la deuda médica, el trabajo
 * que revisa crédito.
 *
 * Reglas que respetan todos: tuteo neutro (nunca voseo), sin prometer borrar
 * información correcta, sin garantizar puntajes ni plazos exactos.
 */
import type { VarianteGuion } from "./tipos";

export const LOTE_01: VarianteGuion[] = [
  {
    slug: "renta-negada",
    titulo: "Reel · Te negaron el apartamento y no fue por el dinero",
    formato: "reel",
    duracionSeg: 38,
    plataforma: "reels",
    angulo: "Alquiler negado por crédito — momento cotidiano no explotado",
    contenido: `# Te negaron el apartamento y no fue por el dinero

## Gancho (0:00–0:06)
> [VISUAL: Mano sosteniendo un teléfono con un correo abierto: "Su solicitud no fue aprobada". Fondo: edificio de apartamentos.]
> [TEXTO EN PANTALLA: "Tenías el depósito. Igual te dijeron que no."]
Tenías el depósito completo. Tenías el trabajo. Y aun así te negaron el apartamento.

## El giro (0:06–0:14)
> [VISUAL: Corte a cara a cámara, tono directo.]
El casero no te rechazó por el dinero. Corrió tu crédito. Y lo que vio le dijo que no.

## Desarrollo (0:14–0:24)
> [VISUAL: Gráfico simple: una carpeta con "REPORTE" y tres sellos: cobranzas, pagos tardíos, cuentas que no reconoces.]
> [TEXTO EN PANTALLA: "Lo que el casero ve"]
Casi todos los edificios grandes revisan tu reporte antes de darte llaves. Y muchos rechazos vienen de cuentas en cobro que ni sabías que estaban ahí.

## Prueba (0:24–0:31)
> [VISUAL: Cara a cámara, tono más cercano.]
Un cliente descubrió una cuenta de una compañía de cable que cerró hace seis años. Nunca fue suya.

## CTA (0:31–0:38)
> [TEXTO EN PANTALLA: "AUDITORÍA GRATIS ⬇"]
Agenda tu auditoría gratis y mira qué está viendo el casero antes de que apliques al próximo.`,
  },

  {
    slug: "seguro-auto-caro",
    titulo: "Reel · Tu seguro de auto es más caro por algo que no imaginas",
    formato: "reel",
    duracionSeg: 38,
    plataforma: "tiktok",
    angulo: "Seguro más caro por score — dato poco conocido, alto impacto",
    contenido: `# Tu seguro de auto es más caro por algo que no imaginas

## Gancho (0:00–0:06)
> [VISUAL: Dos facturas de seguro lado a lado, montos distintos, misma cobertura.]
> [TEXTO EN PANTALLA: "Mismo carro. Mismo récord. Distinto precio."]
Mismo carro. Mismo récord de manejo. Y uno paga casi el doble que el otro.

## El mecanismo (0:06–0:16)
> [VISUAL: Cara a cámara, tono de revelación.]
En la mayoría de los estados, las aseguradoras usan un puntaje basado en tu crédito para calcular tu prima. No tu manejo. Tu crédito.

## Desarrollo (0:16–0:26)
> [VISUAL: Calculadora, números sencillos apareciendo.]
> [TEXTO EN PANTALLA: "Cada mes. Cada renovación."]
Y ese cobro extra no aparece una vez. Se repite cada mes, cada renovación, año tras año, sin que nadie te explique de dónde sale.

## Cierre (0:26–0:34)
> [VISUAL: Cara a cámara.]
Arreglar tu reporte no solo abre puertas. También te deja de cobrar de más en las que ya cruzaste.

## CTA (0:34–0:38)
> [TEXTO EN PANTALLA: "ESCRIBE CRÉDITO ⬇"]
Escribe CRÉDITO y revisamos juntos qué te está costando de más.`,
  },

  {
    slug: "deuda-medica",
    titulo: "Reel · Esa cuenta médica que te está hundiendo el crédito",
    formato: "reel",
    duracionSeg: 43,
    plataforma: "reels",
    angulo: "Deuda médica — muy común en EE. UU., alta carga emocional",
    contenido: `# Esa cuenta médica que te está hundiendo el crédito

## Gancho (0:00–0:06)
> [VISUAL: Sobre de hospital sin abrir sobre una mesa de cocina.]
> [TEXTO EN PANTALLA: "Te enfermaste. Y el reporte te castigó."]
Te enfermaste una vez. Y tu reporte de crédito te sigue cobrando la cuenta años después.

## El problema (0:06–0:16)
> [VISUAL: Cara a cámara, tono serio y cercano.]
Una emergencia, un copago mal facturado, un seguro que no cubrió lo que dijo que cubría. La factura viaja a cobranzas y aparece en tu reporte.

## El dato (0:16–0:26)
> [VISUAL: Gráfico simple: una factura con una lupa encima, señalando "monto", "fecha", "proveedor".]
> [TEXTO EN PANTALLA: "Las médicas son las que más errores traen"]
Las cuentas médicas son de las que más errores de facturación arrastran. Montos que no corresponden, fechas equivocadas, cuentas duplicadas por el mismo tratamiento.

## La solución (0:26–0:38)
> [VISUAL: Modo solución, tono más animado.]
Y una cuenta con datos que no se pueden verificar es exactamente lo que se disputa. No se borra lo que es correcto: se corrige lo que está mal.

## CTA (0:38–0:43)
> [TEXTO EN PANTALLA: "AGENDA TU AUDITORÍA ⬇"]
Agenda tu auditoría gratis y revisamos cada línea médica de tu reporte.`,
  },

  {
    slug: "credito-invisible",
    titulo: "Reel · Llevas años en este país y el sistema no te ve",
    formato: "reel",
    duracionSeg: 43,
    plataforma: "reels",
    angulo: "Crédito invisible del recién llegado — específico del avatar latino",
    contenido: `# Llevas años en este país y el sistema no te ve

## Gancho (0:00–0:07)
> [VISUAL: Persona frente a una laptop, pantalla con el mensaje "No record found".]
> [TEXTO EN PANTALLA: "No es mal crédito. Es NO crédito."]
Trabajas. Pagas renta. Pagas todo en efectivo. Y cuando pides un préstamo te dicen que no existes.

## El reencuadre (0:07–0:15)
> [VISUAL: Cara a cámara, tono directo.]
Eso no es mal crédito. Es crédito invisible. Y se arregla distinto: no hay nada que corregir, hay algo que construir.

## Desarrollo (0:15–0:27)
> [VISUAL: Tres tarjetas apareciendo en pantalla, una por punto.]
> [TEXTO EN PANTALLA: "Construir historial"]
El sistema no premia que pagues en efectivo. Premia que exista un registro de que pagas a tiempo. Y ese registro se puede empezar aunque nunca hayas tenido una tarjeta.

## Prueba (0:27–0:38)
> [VISUAL: Tono cercano, cara a cámara.]
He visto a gente que llevaba ocho años acá, con dos trabajos, invisible para el sistema. Y en meses tenía un historial que un banco puede leer.

## CTA (0:38–0:43)
> [TEXTO EN PANTALLA: "ESCRIBE HISTORIAL ⬇"]
Escribe HISTORIAL y te explico por dónde se empieza en tu caso.`,
  },

  {
    slug: "trabajo-revisa-credito",
    titulo: "Reel · El trabajo que no te dieron y nunca supiste por qué",
    formato: "reel",
    duracionSeg: 30,
    plataforma: "shorts",
    angulo: "Empleo negado por revisión de crédito — poco conocido",
    contenido: `# El trabajo que no te dieron y nunca supiste por qué

## Gancho (0:00–0:04)
> [VISUAL: Pantalla de correo: "Gracias por tu interés. Hemos decidido continuar con otros candidatos."]
> [TEXTO EN PANTALLA: "Pasaste la entrevista. Y aun así, no."]
Pasaste las tres entrevistas. Les caíste bien. Y después, silencio.

## El giro (0:04–0:14)
> [VISUAL: Cara a cámara, tono de confidencia.]
Hay puestos donde el empleador revisa una versión de tu reporte antes de contratar. Sobre todo si vas a manejar dinero, inventario o información de clientes.

## Aclaración honesta (0:14–0:24)
> [VISUAL: Texto sobreimpreso, tono de precisión.]
> [TEXTO EN PANTALLA: "No ven tu puntaje. Ven tu historial."]
No ven tu número. Ven el historial: cuentas en cobro, cuentas atrasadas, cuentas que no reconoces. Y muchas veces esas últimas ni siquiera son tuyas.

## Cierre + CTA (0:24–0:30)
> [VISUAL: Modo solución.]
> [TEXTO EN PANTALLA: "AUDITORÍA GRATIS ⬇"]
Antes de tu próxima entrevista, revisa qué dice tu reporte. Agenda tu auditoría gratis abajo.`,
  },

  {
    slug: "robo-identidad",
    titulo: "Reel · Esa cuenta no es tuya y te está costando dinero",
    formato: "reel",
    duracionSeg: 43,
    plataforma: "reels",
    angulo: "Robo de identidad / cuentas ajenas — genera urgencia legítima",
    contenido: `# Esa cuenta no es tuya y te está costando dinero

## Gancho (0:00–0:06)
> [VISUAL: Dedo recorriendo una lista impresa, deteniéndose en una línea resaltada.]
> [TEXTO EN PANTALLA: "¿Y esta cuenta de dónde salió?"]
Abres tu reporte y hay una cuenta que nunca abriste, en una ciudad donde nunca viviste.

## Desarrollo (0:06–0:20)
> [VISUAL: Cara a cámara, tono serio.]
Pasa más de lo que crees. A veces es robo de identidad. A veces es un error de archivo: alguien con tu mismo nombre, o un dígito cambiado en el número de seguro social.

## El costo (0:20–0:29)
> [VISUAL: Gráfico: una cuenta ajena empujando el puntaje hacia abajo.]
> [TEXTO EN PANTALLA: "No es tuya. Te castiga igual."]
No importa que no sea tuya. Mientras esté en tu reporte, el banco la lee como tuya y te cobra como tal.

## La acción (0:29–0:37)
> [VISUAL: Modo solución, tono firme.]
Ese tipo de cuenta es de las más claras de disputar: si no pueden probar que es tuya, no puede quedarse.

## CTA (0:37–0:43)
> [TEXTO EN PANTALLA: "REVISA TU REPORTE ⬇"]
Agenda tu revisión gratis y vemos línea por línea qué es tuyo y qué no.`,
  },
];
