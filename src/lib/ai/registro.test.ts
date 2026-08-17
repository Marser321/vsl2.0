import { describe, expect, it } from "vitest";
import { renderBriefMessage } from "./prompts";
import { PROMPT_MAESTRO } from "@/db/prompt-maestro";
import type { ScriptBrief } from "@/db/schema";

/**
 * El modelo imita el registro del texto que lee, no la regla que ese texto
 * enuncia. Con el prompt maestro y el mensaje del brief escritos en voseo
 * rioplatense, los guiones salían con "pagás", "tenés" y "agendá" pese a que el
 * prompt pedía español neutro para audiencia latina de EE. UU.
 *
 * Estos tests protegen el registro de los textos que el modelo ve como muestra.
 * Si algún día la agencia quiere generar en voseo para clientes rioplatenses,
 * eso se pide desde el brief — no reescribiendo estos prompts.
 */

/**
 * Formas voseantes: imperativos agudos y presentes de indicativo con vos.
 *
 * Los límites son lookarounds sobre una clase de letras que incluye las
 * acentuadas, NO `\b`: el `\b` de JavaScript se define sobre `[A-Za-z0-9_]`, así
 * que una palabra terminada en vocal acentuada ("agendá", "escribí") no tiene
 * límite de palabra después de la tilde y nunca llega a matchear.
 */
const LETRA = "A-Za-zÀ-ÿ";
const FORMAS = [
  "pagás", "tenés", "querés", "podés", "sabés", "decís", "hacés", "vivís", "sentís",
  "necesitás", "dependés", "publicás", "vendés", "mirás", "sos", "vos",
  "agendá", "escribí", "mirá", "dejá", "mostrá", "contá", "usá", "poné", "abrí",
  "devolvé", "calculá", "respetá", "imitá", "aplicá", "priorizá", "generá",
  "entregá", "elegí", "sumá", "evitá", "cerrá", "arrancá", "terminá",
  "fijate", "acordate", "partilo", "preparalo", "hacelo", "señalalo", "aplicalos",
];
const VOSEO = new RegExp(`(?<![${LETRA}])(?:${FORMAS.join("|")})(?![${LETRA}])`, "gi");

function formasVoseantes(texto: string): string[] {
  return [...new Set((texto.match(VOSEO) ?? []).map((forma) => forma.toLowerCase()))];
}

const brief: ScriptBrief = {
  producto: "Servicio de reparación de crédito",
  audiencia: "Latinos en Estados Unidos con deudas en cobranzas",
  oferta: "Auditoría del reporte sin costo",
  dolores: "Le negaron el crédito",
  objeciones: "«Esto lo puedo hacer yo gratis»",
  duracionMin: 5,
  duracionSeg: 30,
  plataforma: "reels",
  tono: "directo",
  cta: "Agenda tu cita",
  instruccionesExtra: "",
};

describe("registro de los prompts", () => {
  it("el prompt maestro está escrito en tuteo, no en voseo", () => {
    expect(formasVoseantes(PROMPT_MAESTRO)).toEqual([]);
  });

  it("el prompt maestro enuncia la regla de registro explícitamente", () => {
    expect(PROMPT_MAESTRO).toMatch(/tuteo/i);
    expect(PROMPT_MAESTRO).toMatch(/voseo/i);
  });

  it("el mensaje del brief de VSL está en tuteo", () => {
    const mensaje = renderBriefMessage({ brief, framework: null, format: "vsl" });
    expect(formasVoseantes(mensaje)).toEqual([]);
  });

  it("el mensaje del brief de reel está en tuteo", () => {
    const mensaje = renderBriefMessage({ brief, framework: null, format: "reel" });
    expect(formasVoseantes(mensaje)).toEqual([]);
  });

  it("el mensaje del brief cierra pidiendo el registro neutro", () => {
    for (const format of ["vsl", "reel"] as const) {
      const mensaje = renderBriefMessage({ brief, framework: null, format });
      expect(mensaje, format).toMatch(/tuteo/i);
    }
  });

  it("el detector reconoce las formas que motivaron el fix", () => {
    // Sin esto, un detector roto haría pasar los tests de arriba por vacío.
    expect(formasVoseantes("Pagás al día y no te sube. Agendá tu cita, escribí abajo.")).toEqual([
      "pagás",
      "agendá",
      "escribí",
    ]);
  });

  it("el detector no marca formas legítimas del tuteo", () => {
    expect(formasVoseantes("Pagas a tiempo, tienes historial y puedes agendar tu cita ahora.")).toEqual([]);
  });
});
