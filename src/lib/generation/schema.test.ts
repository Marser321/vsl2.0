import { describe, expect, it } from "vitest";
import { generationFieldErrors, generationInputSchema } from "./schema";

const valid = {
  clientId: 1,
  frameworkId: null,
  documentIds: [],
  title: "Guion QA",
  format: "vsl" as const,
  provider: "openrouter" as const,
  model: "openrouter/ensemble-5+1",
  openrouterConfirmed: true,
  brief: {
    producto: "Producto",
    audiencia: "Audiencia",
    oferta: "Oferta",
    dolores: "Dolores",
    objeciones: "",
    duracionMin: 5,
    tono: "",
    cta: "Comprar",
    instruccionesExtra: "",
  },
};

describe("generationInputSchema", () => {
  it("devuelve errores de campo claros en español", () => {
    const parsed = generationInputSchema.safeParse({ ...valid, title: "", brief: { ...valid.brief, cta: "" } });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(generationFieldErrors(parsed.error)).toEqual({
        title: "Escribí un título interno",
        cta: "Escribí el llamado a la acción",
      });
    }
  });

  it("exige confirmación específica para OpenRouter", () => {
    const rejected = generationInputSchema.safeParse({ ...valid, model: "ensemble", openrouterConfirmed: false });
    expect(rejected.success).toBe(false);
    const accepted = generationInputSchema.safeParse({ ...valid, model: "ensemble", openrouterConfirmed: true });
    expect(accepted.success).toBe(true);
  });

  it("rechaza OpenAI como proveedor operativo", () => {
    const parsed = generationInputSchema.safeParse({ ...valid, provider: "openai" });
    expect(parsed.success).toBe(false);
  });
});
