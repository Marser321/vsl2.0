import { describe, expect, it } from "vitest";
import { partirCompilado, tituloDeGuion } from "./split";

const cuerpo = (n: number) =>
  `Titulo del guion ${n}\nLa idea: cara a cámara.\n0:00–0:09\tHook\tAlgo que engancha al espectador desde el arranque.\n` +
  `0:09–0:20\tDesarrollo\tSe explica el mecanismo con detalle suficiente para que el bloque tenga cuerpo real.\n` +
  `0:20–0:30\tCTA\tAgenda tu cita abajo.\nCOPY DE ANUNCIO (META)\nTexto del anuncio.`;

describe("partirCompilado", () => {
  it("parte por encabezados numerados", () => {
    const texto = `GUION 1 DE 30 · POV\n${cuerpo(1)}\n\nGUION 2 DE 30 · SKIT\n${cuerpo(2)}`;
    const guiones = partirCompilado(texto);
    expect(guiones).toHaveLength(2);
    expect(guiones[0].numero).toBe(1);
    expect(guiones[1].numero).toBe(2);
  });

  it("captura el estilo editorial del encabezado", () => {
    const texto = `GUION 1 DE 30 · POV\n${cuerpo(1)}\n\nGUION 2 DE 30 · SKIT, DOBLE PERSONAJE\n${cuerpo(2)}`;
    expect(partirCompilado(texto)[1].estilo).toBe("SKIT, DOBLE PERSONAJE");
  });

  it("acepta el encabezado corto sin 'DE n' ni estilo", () => {
    const texto = `GUION 1\n${cuerpo(1)}\n\nGUION 2\n${cuerpo(2)}`;
    const guiones = partirCompilado(texto);
    expect(guiones).toHaveLength(2);
    expect(guiones[0].estilo).toBeNull();
  });

  it("reconoce el guion insignia sin número y lo numera 0", () => {
    const texto = `★ GUION INSIGNIA DE 20 · CONFESIONAL\n${cuerpo(1)}\n\nGUION 2 DE 20 · POV\n${cuerpo(2)}`;
    const guiones = partirCompilado(texto);
    expect(guiones[0].numero).toBe(0);
    expect(guiones[0].estilo).toBe("CONFESIONAL");
  });

  it("tolera la tilde en 'GUIÓN'", () => {
    const texto = `GUIÓN 1 DE 5 · POV\n${cuerpo(1)}\n\nGUIÓN 2 DE 5 · SKIT\n${cuerpo(2)}`;
    expect(partirCompilado(texto)).toHaveLength(2);
  });

  it("descarta las entradas del índice, que no tienen cuerpo", () => {
    const indice = "GUION 1 DE 30 · POV\nGUION 2 DE 30 · SKIT\n";
    const texto = `${indice}\nGUION 1 DE 30 · POV\n${cuerpo(1)}\n\nGUION 2 DE 30 · SKIT\n${cuerpo(2)}`;
    expect(partirCompilado(texto)).toHaveLength(2);
  });

  it("limpia los pies de página repetidos del PDF", () => {
    const texto =
      `GUION 1 DE 30 · POV\n${cuerpo(1)}\nAD MEDIA SOLUTION * CONFIDENCIAL\n-- 3 of 22 --\n` +
      `GUION 2 DE 30 · SKIT\n${cuerpo(2)}`;
    const guiones = partirCompilado(texto);
    expect(guiones[0].texto).not.toContain("CONFIDENCIAL");
    expect(guiones[0].texto).not.toContain("of 22");
  });

  it("conserva el encabezado dentro del texto del guion", () => {
    const texto = `GUION 1 DE 30 · POV\n${cuerpo(1)}\n\nGUION 2 DE 30 · SKIT\n${cuerpo(2)}`;
    expect(partirCompilado(texto)[0].texto).toContain("GUION 1 DE 30 · POV");
  });

  it("devuelve vacío cuando no es un compilado", () => {
    expect(partirCompilado("Un guion suelto sin encabezados numerados.")).toEqual([]);
  });

  it("devuelve vacío con un solo encabezado: no hay nada que partir", () => {
    expect(partirCompilado(`GUION 1 DE 1 · POV\n${cuerpo(1)}`)).toEqual([]);
  });
});

describe("tituloDeGuion", () => {
  const texto = `GUION 7 DE 30 · POV\n${cuerpo(7)}\n\nGUION 8 DE 30 · SKIT\n${cuerpo(8)}`;
  const guiones = partirCompilado(texto);

  it("compone el título con el compilado, el número y el título editorial", () => {
    expect(tituloDeGuion(guiones[0], "Guiones Yoan")).toBe("Guiones Yoan · 7. Titulo del guion 7");
  });

  it("marca el insignia por nombre en vez de por número", () => {
    const conInsignia = partirCompilado(`★ GUION INSIGNIA DE 20 · CONFESIONAL\n${cuerpo(1)}\n\nGUION 2 DE 20 · POV\n${cuerpo(2)}`);
    expect(tituloDeGuion(conInsignia[0], "Casa")).toContain("insignia");
  });
});
