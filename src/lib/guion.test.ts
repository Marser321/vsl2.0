import { describe, expect, it } from "vitest";
import { separarGuion, soloLocucion } from "./guion";

describe("separarGuion", () => {
  it("separa la locución de las acotaciones de un beat típico", () => {
    const [bloque] = separarGuion(
      `## Gancho (0:00–0:03)\n> [VISUAL: primer plano]\n> [TEXTO EN PANTALLA: tu score no sube]\n\nPagas a tiempo y tu score no sube.`
    );
    expect(bloque.titulo).toBe("Gancho");
    expect(bloque.rango).toBe("0:00–0:03");
    expect(bloque.locucion).toEqual(["Pagas a tiempo y tu score no sube."]);
    expect(bloque.acotaciones).toEqual(["VISUAL: primer plano", "TEXTO EN PANTALLA: tu score no sube"]);
  });

  it("saca el rótulo «Locución:» y conserva lo que se dice", () => {
    const [bloque] = separarGuion("## Beat\n\n**Locución:** Hola a todos.");
    expect(bloque.locucion).toEqual(["Hola a todos."]);
  });

  it("reconoce otros rótulos de locución", () => {
    expect(separarGuion("## B\n\nVoz en off: Texto uno.")[0].locucion).toEqual(["Texto uno."]);
    expect(separarGuion("## B\n\nVO: Texto dos.")[0].locucion).toEqual(["Texto dos."]);
  });

  it("manda los encabezados H3 y más profundos a acotaciones", () => {
    const [bloque] = separarGuion("## Desarrollo\n\n### Bloque A (0:06–0:12)\n\nEsto sí se dice.");
    expect(bloque.locucion).toEqual(["Esto sí se dice."]);
    expect(bloque.acotaciones).toContain("Bloque A (0:06–0:12)");
  });

  it("captura acotaciones en blockquote de varias líneas", () => {
    const [bloque] = separarGuion(
      "## Beat\n> [GUÍA: primera línea\n> segunda línea]\n\nTexto a locutar."
    );
    expect(bloque.locucion).toEqual(["Texto a locutar."]);
    expect(bloque.acotaciones.join(" ")).toContain("segunda línea");
  });

  it("captura blockquotes sin corchetes", () => {
    const [bloque] = separarGuion("## Beat\n> Nota suelta del redactor\n\nTexto a locutar.");
    expect(bloque.locucion).toEqual(["Texto a locutar."]);
    expect(bloque.acotaciones).toContain("Nota suelta del redactor");
  });

  it("captura acotaciones etiquetadas sin blockquote", () => {
    const [bloque] = separarGuion("## Beat\n[VISUAL: sin blockquote]\n\nTexto a locutar.");
    expect(bloque.locucion).toEqual(["Texto a locutar."]);
    expect(bloque.acotaciones).toContain("VISUAL: sin blockquote");
  });

  it("ignora el H1, que es el título del guion y no se locuta", () => {
    const bloques = separarGuion("# Reel: título\n\n## Gancho\n\nTexto.");
    expect(bloques).toHaveLength(1);
    expect(bloques[0].titulo).toBe("Gancho");
  });

  it("preserva los marcadores con guiones bajos", () => {
    const [bloque] = separarGuion("## B\n\nUsa {{OTRAS_SOLUCIONES_FALLIDAS}} y {{QUE_PASA_DESPUES}}.");
    expect(bloque.locucion[0]).toContain("{{OTRAS_SOLUCIONES_FALLIDAS}}");
    expect(bloque.locucion[0]).toContain("{{QUE_PASA_DESPUES}}");
  });

  it("quita énfasis y código de la locución", () => {
    expect(separarGuion("## B\n\nTexto **importante** y `literal`.")[0].locucion).toEqual([
      "Texto importante y literal.",
    ]);
  });

  it("separa los párrafos por línea en blanco", () => {
    const [bloque] = separarGuion("## B\n\nPrimer párrafo.\n\nSegundo párrafo.");
    expect(bloque.locucion).toEqual(["Primer párrafo.", "Segundo párrafo."]);
  });

  it("une las líneas de un mismo párrafo", () => {
    const [bloque] = separarGuion("## B\n\nUna línea\ny su continuación.");
    expect(bloque.locucion).toEqual(["Una línea y su continuación."]);
  });

  it("conserva el texto sin encabezados como bloque de apertura", () => {
    const bloques = separarGuion("Texto suelto sin ningún encabezado.");
    expect(bloques[0].titulo).toBe("Apertura");
    expect(bloques[0].locucion).toEqual(["Texto suelto sin ningún encabezado."]);
  });

  it("devuelve un bloque vacío para un guion vacío, sin romper", () => {
    expect(separarGuion("")).toHaveLength(1);
  });
});

describe("soloLocucion", () => {
  it("deja un guion completo sin una sola acotación", () => {
    const guion = `# Reel: por qué tu score no sube

## Gancho (0:00–0:03)
> [VISUAL: persona mirando el teléfono]
> [TEXTO EN PANTALLA: "Pagas a tiempo… ¿y el score quieto?"]
Pagas a tiempo y tu score no sube.

## Desarrollo (0:03–0:20)

### Bloque A (0:03–0:12)
> [VISUAL: animación del pastel del score]
**Locución:** Pagar a tiempo es solo el 35% de la fórmula.

## CTA (0:20–0:30)
> [TEXTO EN PANTALLA: AGENDA ⬇️]
Escribe CRÉDITO y te mando la auditoría gratis.`;

    const salida = soloLocucion(guion);
    expect(salida).toBe(
      "Pagas a tiempo y tu score no sube.\n\n" +
        "Pagar a tiempo es solo el 35% de la fórmula.\n\n" +
        "Escribe CRÉDITO y te mando la auditoría gratis."
    );
    for (const ruido of ["VISUAL", "TEXTO EN PANTALLA", "Locución", "###", "Bloque A", "0:00"]) {
      expect(salida, ruido).not.toContain(ruido);
    }
  });
});

describe("guiones tabulados (los extraídos de los PDF de la agencia)", () => {
  const guion = `GUION 7 DE 20 · REVEAL

Abriendo la Carta Que Antes Decía Que No
La idea (cómo grabarlo): cliente real abriendo un sobre.
Tiempo \tBloque \tQué se dice \tVisual
0:00–0:08 \tHook \tEstá a punto de abrir la carta de pre-aprobación.
0:08–0:16 \tEl suspenso \tHace seis meses: rechazada. \tManos abriendo el sobre
0:16–0:23 \tEl reveal \t(lee) 'Pre-aprobada.' \tReacción genuina`;

  it("parte por fila de tiempo en vez de dejar un solo bloque", () => {
    const bloques = separarGuion(guion);
    // Sin esto, un guion entero era un único bloque y no se podía copiar el
    // gancho por separado — que es justo para lo que sirve la vista.
    expect(bloques.length).toBeGreaterThanOrEqual(3);
    expect(bloques.map((b) => b.titulo)).toEqual(
      expect.arrayContaining(["Hook", "El suspenso", "El reveal"])
    );
  });

  it("guarda el rango de tiempo de cada bloque", () => {
    const conRango = separarGuion(guion).find((b) => b.titulo === "El suspenso");
    expect(conRango?.rango).toBe("0:08–0:16");
  });

  it("toma como locución lo que se dice, no la columna visual", () => {
    const suspenso = separarGuion(guion).find((b) => b.titulo === "El suspenso");
    expect(suspenso?.locucion.join(" ")).toContain("Hace seis meses: rechazada.");
    expect(suspenso?.locucion.join(" ")).not.toContain("Manos abriendo el sobre");
  });

  it("no confunde un rango dentro de un encabezado markdown", () => {
    const bloques = separarGuion("## Gancho (0:00–0:03)\n\nTexto.");
    expect(bloques).toHaveLength(1);
    expect(bloques[0].titulo).toBe("Gancho");
  });
});
