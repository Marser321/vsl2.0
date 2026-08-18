import { describe, expect, it } from "vitest";
import { analyzeScript } from "./readtime";

describe("analyzeScript", () => {
  it("preserva exactamente los marcadores con guiones bajos", () => {
    const result = analyzeScript("## Sección\n\nUsá {{OTRAS_SOLUCIONES_FALLIDAS}} y {{QUE_PASA_DESPUES}}.");
    expect(result.sections[0].text).toContain("{{OTRAS_SOLUCIONES_FALLIDAS}}");
    expect(result.sections[0].text).toContain("{{QUE_PASA_DESPUES}}");
  });

  it("quita énfasis markdown sin alterar el contenido", () => {
    const result = analyzeScript("## Sección\n\nTexto **importante** y `literal`.");
    expect(result.sections[0].text).toBe("Texto importante y literal.");
  });
});

describe("analyzeScript sobre la locución", () => {
  const guion = `## Gancho (0:00–0:03)
> [VISUAL: un plano larguísimo lleno de palabras que no se locutan jamás en cámara]
> [TEXTO EN PANTALLA: más y más palabras de acotación que tampoco se dicen nunca]

Dos palabras.`;

  it("no cuenta las palabras de las acotaciones", () => {
    // Antes las acotaciones inflaban el conteo y, con él, la duración estimada.
    expect(analyzeScript(guion).sections[0].words).toBe(2);
  });

  it("no deja acotaciones en el texto de la sección", () => {
    const { text } = analyzeScript(guion).sections[0];
    expect(text).toBe("Dos palabras.");
  });

  it("no toma una acotación como apelación al espectador", () => {
    // "[VISUAL: mira a cámara]" contiene "mira": antes tapaba la fuga real.
    const sinApelacion = `## Beat\n> [VISUAL: mira a cámara]\n\n${"palabra ".repeat(70)}`;
    expect(analyzeScript(sinApelacion).sections[0].leakFlags.join(" ")).toContain(
      "Sin apelación directa"
    );
  });

  it("sigue detectando la apelación cuando está en la locución", () => {
    const conApelacion = `## Beat\n\n¿Sabes por qué? ${"palabra ".repeat(70)}`;
    expect(analyzeScript(conApelacion).sections[0].leakFlags.join(" ")).not.toContain(
      "Sin apelación directa"
    );
  });
});
