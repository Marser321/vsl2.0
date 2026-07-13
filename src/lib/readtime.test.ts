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
