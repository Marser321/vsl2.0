import { describe, expect, it } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { GuionPdf, type DatosGuionPdf } from "./GuionPdf";

const base: DatosGuionPdf = {
  titulo: "Reel · El puntaje no sube por pagar",
  cliente: "Vertical — Reparación de crédito",
  formato: "reel",
  version: 2,
  descripcion: "Servicio de reparación de crédito · Latinos en EE. UU.",
  fecha: new Date("2026-08-17T12:00:00Z"),
  contenido: `# Reel: por qué tu score no sube

## Gancho (0:00–0:03)
> [VISUAL: persona mirando el teléfono]
> [TEXTO EN PANTALLA: "1️⃣ Pagas a tiempo… ¿y el score quieto?" 🚀]
Pagas a tiempo y tu score no sube.

## CTA (0:24–0:30)
> [TEXTO EN PANTALLA: AGENDA ⬇️]
Escribe CRÉDITO y te mando la auditoría gratis.`,
};

/** El PDF se arma con renderToBuffer, igual que en el endpoint. */
async function render(datos: DatosGuionPdf) {
  return renderToBuffer(GuionPdf({ datos }));
}

describe("GuionPdf", () => {
  it("produce un PDF válido con portada y contenido", async () => {
    const buffer = await render(base);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // Portada + al menos una página de guion.
    const paginas = buffer.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(paginas.length).toBeGreaterThanOrEqual(2);
  }, 30_000);

  it("no falla con emojis, que las fuentes estándar del PDF no tienen", async () => {
    // Sin saneado, un emoji corrompe el carácter siguiente en el texto.
    await expect(render(base)).resolves.toBeInstanceOf(Buffer);
  }, 30_000);

  it("no falla con un guion sin cliente ni descripción", async () => {
    await expect(
      render({ ...base, cliente: null, descripcion: null })
    ).resolves.toBeInstanceOf(Buffer);
  }, 30_000);

  it("no falla con un guion sin estructura de beats", async () => {
    await expect(
      render({ ...base, contenido: "Un texto suelto, sin encabezados ni acotaciones." })
    ).resolves.toBeInstanceOf(Buffer);
  }, 30_000);

  it("acepta el formato VSL", async () => {
    await expect(render({ ...base, formato: "vsl" })).resolves.toBeInstanceOf(Buffer);
  }, 30_000);
});
