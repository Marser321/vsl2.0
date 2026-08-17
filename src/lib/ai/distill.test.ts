import { describe, expect, it } from "vitest";
import {
  armarLotes,
  clavePatron,
  consolidarPatrones,
  patronesCorroborados,
  renderDoctrina,
  type Patron,
} from "./distill";

const patron = (categoria: Patron["categoria"], texto: string, ejemplo = "ej"): Patron => ({
  categoria,
  patron: texto,
  ejemplo,
});

describe("armarLotes", () => {
  const tokens = (d: { tokens: number }) => d.tokens;

  it("agrupa hasta llenar el presupuesto", () => {
    const docs = [{ tokens: 400 }, { tokens: 400 }, { tokens: 400 }];
    const lotes = armarLotes(docs, tokens, 1000);
    expect(lotes).toHaveLength(2);
    expect(lotes[0].documentos).toHaveLength(2);
    expect(lotes[1].documentos).toHaveLength(1);
  });

  it("reporta los tokens acumulados de cada lote", () => {
    const lotes = armarLotes([{ tokens: 300 }, { tokens: 300 }], tokens, 1000);
    expect(lotes[0].tokensEstimados).toBe(600);
  });

  it("numera los lotes correlativamente", () => {
    const lotes = armarLotes([{ tokens: 900 }, { tokens: 900 }, { tokens: 900 }], tokens, 1000);
    expect(lotes.map((l) => l.indice)).toEqual([0, 1, 2]);
  });

  it("manda solo a un documento más grande que el presupuesto en vez de descartarlo", () => {
    const lotes = armarLotes([{ tokens: 5000 }, { tokens: 100 }], tokens, 1000);
    expect(lotes).toHaveLength(2);
    expect(lotes[0].documentos).toHaveLength(1);
  });

  it("devuelve vacío sin documentos", () => {
    expect(armarLotes([], tokens, 1000)).toEqual([]);
  });
});

describe("clavePatron", () => {
  it("iguala redacciones equivalentes con distinto orden y puntuación", () => {
    expect(clavePatron("Abrir con una pregunta directa")).toBe(clavePatron("pregunta directa, abrir con una"));
  });

  it("ignora acentos y mayúsculas", () => {
    expect(clavePatron("Mención del puntaje")).toBe(clavePatron("mencion del puntaje"));
  });

  it("distingue patrones realmente distintos", () => {
    expect(clavePatron("abrir con pregunta")).not.toBe(clavePatron("cerrar con urgencia"));
  });
});

describe("consolidarPatrones", () => {
  it("cuenta en cuántos lotes apareció cada patrón", () => {
    const resultado = consolidarPatrones([
      [patron("ganchos", "Abrir con una pregunta directa")],
      [patron("ganchos", "abrir con una pregunta directa")],
      [patron("ganchos", "Cerrar con urgencia")],
    ]);
    const abrir = resultado.find((p) => p.patron.toLowerCase().includes("abrir"));
    expect(abrir?.evidencia).toBe(2);
    expect(resultado.find((p) => p.patron.includes("Cerrar"))?.evidencia).toBe(1);
  });

  it("no suma evidencia por repetir el patrón dentro del mismo lote", () => {
    const resultado = consolidarPatrones([
      [patron("ganchos", "Abrir con pregunta"), patron("ganchos", "abrir con pregunta")],
    ]);
    expect(resultado[0].evidencia).toBe(1);
  });

  it("no mezcla el mismo texto en categorías distintas", () => {
    const resultado = consolidarPatrones([
      [patron("ganchos", "Mencionar el puntaje"), patron("lexico", "Mencionar el puntaje")],
    ]);
    expect(resultado).toHaveLength(2);
  });

  it("conserva la redacción más larga entre variantes equivalentes", () => {
    const resultado = consolidarPatrones([
      [patron("beats", "Abrir con pregunta directa")],
      [patron("beats", "Abrir con una pregunta directa")],
    ]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].patron).toBe("Abrir con una pregunta directa");
  });

  it("no colapsa reglas de distinta especificidad", () => {
    const resultado = consolidarPatrones([
      [patron("beats", "Abrir con pregunta")],
      [patron("beats", "Abrir con pregunta sobre la deuda")],
    ]);
    expect(resultado).toHaveLength(2);
  });

  it("ordena por evidencia descendente", () => {
    const resultado = consolidarPatrones([
      [patron("ganchos", "raro")],
      [patron("ganchos", "comun")],
      [patron("ganchos", "comun")],
    ]);
    expect(resultado[0].patron).toBe("comun");
  });

  it("descarta patrones vacíos", () => {
    expect(consolidarPatrones([[patron("ganchos", "   ")]])).toEqual([]);
  });
});

describe("patronesCorroborados", () => {
  const patrones = consolidarPatrones([
    [patron("ganchos", "comun")],
    [patron("ganchos", "comun")],
    [patron("ganchos", "raro")],
  ]);

  it("filtra los que aparecen en un solo lote", () => {
    const resultado = patronesCorroborados(patrones, 3, 2, 1);
    expect(resultado.map((p) => p.patron)).toEqual(["comun"]);
  });

  it("deja pasar todo cuando hubo un solo lote", () => {
    const uno = consolidarPatrones([[patron("ganchos", "unico")]]);
    expect(patronesCorroborados(uno, 1)).toHaveLength(1);
  });

  it("no vacía el resultado cuando casi nada se corroboró", () => {
    // Sin la red de seguridad esto devolvería solo "comun" y la destilación
    // se quedaría con un único patrón pese a tener material suficiente.
    const resultado = patronesCorroborados(patrones, 3, 2, 12);
    expect(resultado.length).toBeGreaterThan(1);
  });

  it("respeta el filtro estricto cuando hay corroborados de sobra", () => {
    const muchos = consolidarPatrones(
      Array.from({ length: 3 }, () => Array.from({ length: 15 }, (_, i) => patron("ganchos", `regla ${i}`)))
    );
    const resultado = patronesCorroborados(muchos, 3, 2, 12);
    expect(resultado.every((p) => p.evidencia >= 2)).toBe(true);
  });
});

describe("renderDoctrina", () => {
  const patrones = consolidarPatrones([
    [patron("ganchos", "Abrir con el puntaje exacto", "«Tu score dice 512»")],
    [patron("ganchos", "Abrir con el puntaje exacto", "«Tu score dice 512»")],
  ]);

  it("arma el documento con título, conteo de evidencia y ejemplo", () => {
    const md = renderDoctrina({
      industria: "reparación de crédito",
      formato: "vsl",
      patrones,
      totalDocumentos: 24,
      totalLotes: 2,
    });
    expect(md).toContain("# Anatomía del VSL de reparación de crédito");
    expect(md).toContain("24 guiones");
    expect(md).toContain("en 2 de 2 lotes");
    expect(md).toContain("«Tu score dice 512»");
  });

  it("omite las secciones sin patrones", () => {
    const md = renderDoctrina({ industria: "x", formato: "reel", patrones, totalDocumentos: 1, totalLotes: 1 });
    expect(md).toContain("Ganchos que se repiten");
    expect(md).not.toContain("Léxico del avatar");
  });
});
