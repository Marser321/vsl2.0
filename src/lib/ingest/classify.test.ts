import { describe, expect, it } from "vitest";
import { clasificar, contarPalabras, huellaContenido } from "./classify";

const palabras = (n: number) => Array.from({ length: n }, (_, i) => `palabra${i}`).join(" ");

describe("clasificar", () => {
  it("detecta reel por marcadores de dirección visual", () => {
    const texto = `# Gancho\n> [VISUAL: primer plano de la carta del banco]\nTu score no sube por esto.\n${palabras(1200)}`;
    expect(clasificar(texto).format).toBe("reel");
  });

  it("detecta reel por texto en pantalla", () => {
    expect(clasificar("> [TEXTO EN PANTALLA: 3 errores]\nMirá esto.").format).toBe("reel");
  });

  it("detecta reel por timestamps en segundos sin minutos", () => {
    const texto = `(0:00–0:03) Gancho\n(0:03–0:12) Desarrollo\n(0:12–0:20) Cierre\n${palabras(1200)}`;
    expect(clasificar(texto).format).toBe("reel");
  });

  it("detecta reel por brevedad", () => {
    expect(clasificar(palabras(120)).format).toBe("reel");
  });

  it("detecta VSL por timestamps en minutos", () => {
    const texto = `03:20 Presentación del mecanismo\n12:45 Oferta\n${palabras(600)}`;
    expect(clasificar(texto).format).toBe("vsl");
  });

  it("detecta VSL por extensión", () => {
    expect(clasificar(palabras(1500)).format).toBe("vsl");
  });

  it("deja en zona gris lo que no tiene evidencia suficiente", () => {
    const resultado = clasificar(palabras(600));
    expect(resultado.format).toBeNull();
    expect(resultado.motivo).toContain("zona gris");
  });

  it("los marcadores de reel ganan sobre los timestamps en minutos", () => {
    const texto = `> [VISUAL: pantalla del celular]\n03:20 no debería importar\n${palabras(1500)}`;
    expect(clasificar(texto).format).toBe("reel");
  });

  it("reconoce un brief por sus encabezados de campo", () => {
    const texto = "Producto: curso\nAudiencia: deudores\nOferta: 3 pagos\nDolores: cobranzas\nCTA: agendar";
    expect(clasificar(texto).kind).toBe("brief");
  });

  it("deja los briefs sin formato: sirven para VSL y para reel por igual", () => {
    const texto = "Producto: curso\nAudiencia: deudores\nOferta: 3 pagos\nDolores: cobranzas\nCTA: agendar";
    expect(clasificar(texto).format).toBeNull();
  });

  it("no confunde un guion largo con una sola línea de campo", () => {
    expect(clasificar(`Audiencia: deudores\n${palabras(1500)}`).kind).toBe("winning_script");
  });

  it("siempre devuelve un motivo auditable", () => {
    expect(clasificar(palabras(1500)).motivo).toBeTruthy();
  });
});

describe("contarPalabras", () => {
  it("cuenta ignorando espaciado irregular", () => {
    expect(contarPalabras("  hola   mundo \n cruel ")).toBe(3);
  });

  it("devuelve cero para texto vacío", () => {
    expect(contarPalabras("   \n  ")).toBe(0);
  });
});

describe("huellaContenido", () => {
  it("iguala el mismo guion con distinto formateo", () => {
    expect(huellaContenido("Hola   mundo\n\ncruel")).toBe(huellaContenido("hola mundo cruel"));
  });

  it("distingue contenidos distintos", () => {
    expect(huellaContenido("guion uno")).not.toBe(huellaContenido("guion dos"));
  });
});
