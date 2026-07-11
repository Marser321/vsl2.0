import { describe, expect, it } from "vitest";
import { resolvePlaceholders, slugify } from "./templates";

describe("resolvePlaceholders", () => {
  const client = { name: "Estudio Norte", industry: "gastronomía" };

  it("resuelve tokens del cliente y del brief", () => {
    const out = resolvePlaceholders(
      "Hola {{CLIENTE}} ({{INDUSTRIA}}): vendemos {{PRODUCTO}} a {{AUDIENCIA}}.",
      client,
      { producto: "menú ejecutivo", audiencia: "oficinistas" }
    );
    expect(out).toBe("Hola Estudio Norte (gastronomía): vendemos menú ejecutivo a oficinistas.");
  });

  it("deja literales los tokens sin valor (checklist del editor)", () => {
    const out = resolvePlaceholders("Oferta: {{OFERTA}} · CTA: {{CTA}}", client, { oferta: "  " });
    expect(out).toBe("Oferta: {{OFERTA}} · CTA: {{CTA}}");
  });

  it("no toca tokens desconocidos ni industria nula", () => {
    const out = resolvePlaceholders("{{OTRA_COSA}} en {{INDUSTRIA}}", { name: "X", industry: null }, {});
    expect(out).toBe("{{OTRA_COSA}} en {{INDUSTRIA}}");
  });

  it("reemplaza todas las ocurrencias", () => {
    const out = resolvePlaceholders("{{CLIENTE}} y {{CLIENTE}}", client, {});
    expect(out).toBe("Estudio Norte y Estudio Norte");
  });
});

describe("slugify", () => {
  it("normaliza acentos, espacios y símbolos", () => {
    expect(slugify("VSL Clásica — 5 minutos ¡Ya!")).toBe("vsl-clasica-5-minutos-ya");
  });
  it("nunca devuelve vacío", () => {
    expect(slugify("¡¡¡")).toBe("plantilla");
  });
});
