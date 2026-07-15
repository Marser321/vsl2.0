import { describe, expect, it } from "vitest";
import { maxDuration as generateMaxDuration } from "@/app/api/generate/route";
import { maxDuration as retryMaxDuration } from "@/app/api/scripts/[id]/retry/route";
import { maxDuration as refineMaxDuration } from "@/app/api/scripts/[id]/refine/route";
import { renderBriefMessage } from "@/lib/ai/prompts";

describe("límites de ejecución de generación", () => {
  it("deja tiempo suficiente para el arnés OpenRouter 5+1", () => {
    expect(generateMaxDuration).toBe(300);
    expect(retryMaxDuration).toBe(300);
    expect(refineMaxDuration).toBe(300);
  });

  it("convierte la duración VSL en un límite verificable", () => {
    const prompt = renderBriefMessage({
      format: "vsl",
      framework: null,
      brief: {
        producto: "Servicio",
        audiencia: "Empresas",
        oferta: "Diagnóstico",
        dolores: "Inconsistencia",
        objeciones: "",
        duracionMin: 4,
        tono: "Claro",
        cta: "Agendar",
        instruccionesExtra: "",
      },
    });
    expect(prompt).toContain("entre 540 y 660 palabras");
    expect(prompt).toContain("terminar en 4:00");
    expect(prompt).toContain("No agregues precios, métricas, testimonios");
  });
});
