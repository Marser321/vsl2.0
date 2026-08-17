import { describe, expect, it } from "vitest";
import { detectarVoseo, normalizarATuteo } from "./registro";

const t = (texto: string) => normalizarATuteo(texto).texto;

describe("normalizarATuteo", () => {
  it("convierte el presente de indicativo regular", () => {
    expect(t("Si agendás hoy, accedés al plan completo.")).toBe("Si agendas hoy, accedes al plan completo.");
  });

  it("recupera la diptongación que el voseo pierde", () => {
    expect(t("Si pensás que perdés tiempo, no sabés lo que dormís.")).toBe(
      "Si piensas que pierdes tiempo, no sabes lo que duermes."
    );
  });

  it("convierte imperativos agudos en -á, que son inequívocos", () => {
    expect(t("Agendá tu cita y mirá el video.")).toBe("Agenda tu cita y mira el video.");
  });

  it("no toca las formas en -í: el pretérito y el imperativo voseante coinciden", () => {
    // "Subí 80 puntos" (yo subí) y "Subí el volumen" (vos subí) son idénticos.
    // Convertir rompería el testimonio en primera persona, que es peor.
    const texto = "Subí 80 puntos en tres meses.";
    expect(t(texto)).toBe(texto);
  });

  it("reporta las formas ambiguas para revisión humana", () => {
    const r = normalizarATuteo("Escribí abajo y subí el volumen.");
    expect(r.sinResolver).toContain("escribí");
    expect(r.sinResolver).toContain("subí");
  });

  it("no reporta como ambiguo lo que sí supo convertir", () => {
    const r = normalizarATuteo("Sentí la diferencia y seguí adelante.");
    expect(r.texto).toBe("Siente la diferencia y sigue adelante.");
    expect(r.sinResolver).toEqual([]);
  });

  it("convierte imperativos irregulares", () => {
    expect(t("Tené paciencia, hacé la prueba y vení mañana.")).toBe(
      "Ten paciencia, haz la prueba y ven mañana."
    );
  });

  it("convierte enclíticos moviendo la tilde", () => {
    expect(t("Hacelo hoy: usala, guardala y fijate el resultado.")).toBe(
      "Hazlo hoy: úsala, guárdala y fíjate el resultado."
    );
  });

  it("convierte 'sos' y 'vos' sujeto", () => {
    expect(t("Sos vos quien decide.")).toBe("Eres tú quien decide.");
  });

  it("traduce 'vos' como 'ti' después de preposición", () => {
    // "sobre tú" no existe: tras preposición el pronombre es "ti".
    expect(t("Lo que guardan sobre vos y lo que hicieron para vos.")).toBe(
      "Lo que guardan sobre ti y lo que hicieron para ti."
    );
  });

  it("traduce 'con vos' como 'contigo'", () => {
    expect(t("Trabajamos con vos desde el primer día.")).toBe("Trabajamos contigo desde el primer día.");
  });

  it("conserva la capitalización", () => {
    expect(t("Agendá ya. AGENDÁ YA.")).toBe("Agenda ya. AGENDA YA.");
  });

  it("no toca un texto que ya está en tuteo", () => {
    const texto = "Pagas a tiempo, tienes historial y puedes agendar tu cita ahora.";
    expect(t(texto)).toBe(texto);
  });

  it("no rompe palabras que terminan igual sin ser voseo", () => {
    const texto = "Después de tres meses de estrés, el interés en inglés creció además del país.";
    expect(t(texto)).toBe(texto);
  });

  it("respeta el pretérito de primera persona, igual en ambos registros", () => {
    const texto = "Probé de todo y encontré la respuesta. Llegué tarde pero gané.";
    expect(t(texto)).toBe(texto);
  });

  it("deja 'estás' intacto: es tuteo correcto", () => {
    expect(t("Si estás listo, empezamos.")).toBe("Si estás listo, empezamos.");
  });

  it("reporta cada cambio para poder auditar la pasada", () => {
    const r = normalizarATuteo("Agendá y tenés todo.");
    expect(r.cambios).toEqual([
      { de: "Agendá", a: "Agenda" },
      { de: "tenés", a: "tienes" },
    ]);
  });

  it("no reporta cambios cuando no toca nada", () => {
    expect(normalizarATuteo("Todo en tuteo neutro.").cambios).toEqual([]);
  });

  it("procesa un guion completo sin dejar voseo", () => {
    const guion = `# Reel
## Gancho (0:00–0:03)
> [VISUAL: primer plano]
Pagás al día y tu score no sube. ¿Sabés por qué?
## Desarrollo (0:03–0:20)
Si cerrás una tarjeta, perdés historial. Mirá lo que pasa: el algoritmo te castiga.
No necesitás abogados. Solo tenés que saber qué disputar.
## CTA (0:20–0:30)
Agendá tu cita gratis y enterate dónde estás parado.`;
    const salida = t(guion);
    expect(detectarVoseo(salida)).toEqual([]);
    expect(salida).toContain("Pagas al día");
    expect(salida).toContain("¿Sabes por qué?");
    expect(salida).toContain("pierdes historial");
    expect(salida).toContain("Agenda tu cita");
    expect(salida).toContain("entérate");
    // El markdown y las acotaciones no se tocan.
    expect(salida).toContain("> [VISUAL: primer plano]");
    expect(salida).toContain("## Gancho (0:00–0:03)");
  });
});

describe("detectarVoseo", () => {
  it("encuentra las formas que el normalizador sabe convertir", () => {
    expect(detectarVoseo("Agendá y pagás").sort()).toEqual(["agendá", "pagás"]);
  });

  it("no marca un texto en tuteo", () => {
    expect(detectarVoseo("Agenda tu cita y paga a tiempo.")).toEqual([]);
  });

  it("no marca pretéritos ni palabras protegidas", () => {
    expect(detectarVoseo("Probé el café después del inglés.")).toEqual([]);
  });
});
