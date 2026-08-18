import { describe, expect, it } from "vitest";
import { ajustarTiempos } from "./guion-tiempos";

describe("ajustarTiempos", () => {
  const guion = `# Reel

## Gancho (0:00–0:03)
> [VISUAL: algo]
${"palabra ".repeat(25)}

## Cierre (0:03–0:06)
${"palabra ".repeat(50)}`;

  it("reescribe los rangos según la locución real", () => {
    const { contenido } = ajustarTiempos(guion, "reel");
    // 25 palabras a 2,5 por segundo = 10 s; 50 palabras = 20 s más.
    expect(contenido).toContain("## Gancho (0:00–0:10)");
    expect(contenido).toContain("## Cierre (0:10–0:30)");
  });

  it("reporta el total y cada ajuste", () => {
    const { totalSec, ajustes } = ajustarTiempos(guion, "reel");
    expect(totalSec).toBe(30);
    expect(ajustes).toEqual([
      { beat: "Gancho", antes: "0:00–0:03", ahora: "0:00–0:10" },
      { beat: "Cierre", antes: "0:03–0:06", ahora: "0:10–0:30" },
    ]);
  });

  it("usa un ritmo más lento para VSL", () => {
    const { totalSec } = ajustarTiempos(guion, "vsl");
    // 75 palabras a 150 por minuto = 30 s, con el mismo texto.
    expect(totalSec).toBe(30);
  });

  it("no toca las acotaciones ni el resto del texto", () => {
    const { contenido } = ajustarTiempos(guion, "reel");
    expect(contenido).toContain("> [VISUAL: algo]");
    expect(contenido).toContain("# Reel");
  });

  it("deja intactos los beats sin locución", () => {
    const soloAcotacion = "## Intro (9:99–9:99)\n> [VISUAL: nada que decir]\n\n## Habla (0:00–0:01)\nHola mundo.";
    const { contenido } = ajustarTiempos(soloAcotacion, "reel");
    expect(contenido).toContain("## Intro (9:99–9:99)");
    expect(contenido).toContain("## Habla (0:00–0:02)");
  });
});
