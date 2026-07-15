import { describe, expect, it } from "vitest";
import { resolvePublicAppUrl } from "./public-url";

describe("resolvePublicAppUrl", () => {
  it("prioriza la URL configurada y elimina rutas", () => {
    expect(resolvePublicAppUrl({
      requestOrigin: "http://localhost:3000",
      env: { NEXT_PUBLIC_APP_URL: "https://vsl.example.com/app", NODE_ENV: "production" },
    })).toBe("https://vsl.example.com");
  });

  it("usa el dominio de producción de Vercel", () => {
    expect(resolvePublicAppUrl({
      env: { VERCEL_PROJECT_PRODUCTION_URL: "vsl.vercel.app", NODE_ENV: "production", VERCEL_ENV: "production" },
    })).toBe("https://vsl.vercel.app");
  });

  it("rechaza localhost en producción", () => {
    expect(() => resolvePublicAppUrl({
      env: { NEXT_PUBLIC_APP_URL: "http://localhost:3000", NODE_ENV: "production" },
    })).toThrow("dominio público HTTPS");
  });

  it("permite el origen local durante desarrollo", () => {
    expect(resolvePublicAppUrl({
      requestOrigin: "http://localhost:3000",
      env: { NODE_ENV: "development" },
    })).toBe("http://localhost:3000");
  });

  it("rechaza crear enlaces desde un preview", () => {
    expect(() => resolvePublicAppUrl({
      env: { NEXT_PUBLIC_APP_URL: "https://vsl.example.com", NODE_ENV: "production", VERCEL_ENV: "preview" },
    })).toThrow("despliegue de producción");
  });
});
