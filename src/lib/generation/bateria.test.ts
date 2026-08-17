import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { generationInputSchema } from "./schema";

/**
 * El plan de la batería se manda tal cual al mismo schema que valida el wizard.
 * Un brief inválido descubierto en runtime cuesta cuota de OpenRouter; acá
 * cuesta un test de milisegundos.
 */
type BriefPlan = {
  titulo: string;
  formato: "vsl" | "reel";
  duracionMin?: number;
  duracionSeg?: number;
  plataforma?: string;
  producto: string;
  audiencia: string;
  oferta: string;
  dolores: string;
  objeciones?: string;
  tono?: string;
  cta: string;
  instruccionesExtra?: string;
};

const plan: { industria: string; cliente: string; marca: string; briefs: BriefPlan[] } = JSON.parse(
  readFileSync("data/bateria-credito.json", "utf-8")
);

/** Mismo armado que `scripts/generar-bateria.ts`, con ids de prueba. */
function comoEntrada(brief: BriefPlan) {
  return {
    clientId: 1,
    brandId: 1,
    frameworkId: null,
    documentIds: [],
    title: brief.titulo,
    format: brief.formato,
    provider: "openrouter" as const,
    model: "modelo/de-prueba",
    openrouterConfirmed: true,
    brief: {
      producto: brief.producto,
      audiencia: brief.audiencia,
      oferta: brief.oferta,
      dolores: brief.dolores,
      objeciones: brief.objeciones ?? "",
      duracionMin: brief.duracionMin ?? (brief.formato === "reel" ? 1 : 5),
      duracionSeg: brief.duracionSeg,
      plataforma: brief.plataforma ?? "",
      tono: brief.tono ?? "",
      cta: brief.cta,
      instruccionesExtra: brief.instruccionesExtra ?? "",
    },
  };
}

describe("plan de la batería de reparación de crédito", () => {
  it("tiene guiones de los dos formatos", () => {
    const formatos = new Set(plan.briefs.map((b) => b.formato));
    expect(formatos).toContain("vsl");
    expect(formatos).toContain("reel");
  });

  it("no repite títulos (el estado reanudable los usa como clave)", () => {
    const titulos = plan.briefs.map((b) => b.titulo);
    expect(new Set(titulos).size).toBe(titulos.length);
  });

  it.each(plan.briefs.map((b) => [b.titulo, b] as const))("«%s» pasa la validación de generación", (_titulo, brief) => {
    const resultado = generationInputSchema.safeParse(comoEntrada(brief));
    if (!resultado.success) {
      throw new Error(
        resultado.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")
      );
    }
    expect(resultado.success).toBe(true);
  });

  it("los reels declaran duración en segundos y plataforma", () => {
    for (const brief of plan.briefs.filter((b) => b.formato === "reel")) {
      expect(brief.duracionSeg, brief.titulo).toBeGreaterThanOrEqual(15);
      expect(brief.duracionSeg, brief.titulo).toBeLessThanOrEqual(90);
      expect(["tiktok", "reels", "shorts"], brief.titulo).toContain(brief.plataforma);
    }
  });
});
