import { describe, expect, it } from "vitest";
import { industryLabel, industrySlug } from "./industry";

describe("industrySlug", () => {
  it("normaliza acentos, mayúsculas y espacios", () => {
    expect(industrySlug("Reparación de Crédito")).toBe("reparacion-de-credito");
    expect(industrySlug("  REPARACION   DE  CREDITO  ")).toBe("reparacion-de-credito");
  });

  it("colapsa variantes conocidas en el slug canónico", () => {
    expect(industrySlug("Credit Repair")).toBe("reparacion-de-credito");
    expect(industrySlug("reparación crédito")).toBe("reparacion-de-credito");
    expect(industrySlug("Limpieza de crédito")).toBe("reparacion-de-credito");
  });

  it("deja pasar rubros sin alias", () => {
    expect(industrySlug("Gastronomía")).toBe("gastronomia");
    expect(industrySlug("Bienes Raíces")).toBe("bienes-raices");
  });

  it("descarta la puntuación en vez de arrastrarla al slug", () => {
    expect(industrySlug("Salud & Bienestar")).toBe("salud-bienestar");
    expect(industrySlug("E-commerce (DTC)")).toBe("e-commerce-dtc");
  });

  it("devuelve null para entradas vacías o sin caracteres útiles", () => {
    expect(industrySlug(null)).toBeNull();
    expect(industrySlug(undefined)).toBeNull();
    expect(industrySlug("")).toBeNull();
    expect(industrySlug("   ")).toBeNull();
    expect(industrySlug("—")).toBeNull();
  });

  it("es idempotente sobre un slug ya normalizado", () => {
    const once = industrySlug("Reparación de Crédito");
    expect(industrySlug(once)).toBe(once);
  });
});

describe("industryLabel", () => {
  it("arma una etiqueta legible desde el slug", () => {
    expect(industryLabel("reparacion-de-credito")).toBe("Reparacion de credito");
    expect(industryLabel("gastronomia")).toBe("Gastronomia");
  });
});
