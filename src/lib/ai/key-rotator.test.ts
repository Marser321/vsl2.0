import { afterEach, describe, expect, it } from "vitest";
import { ApiKeyEngine, hasOpenRouterKeys } from "./key-rotator";

const originalKeys = process.env.OPENROUTER_API_KEYS;
const originalKey = process.env.OPENROUTER_API_KEY;

afterEach(() => {
  if (originalKeys === undefined) delete process.env.OPENROUTER_API_KEYS;
  else process.env.OPENROUTER_API_KEYS = originalKeys;
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = originalKey;
});

describe("ApiKeyEngine", () => {
  it("permite importar y consultar disponibilidad sin clave", () => {
    delete process.env.OPENROUTER_API_KEYS;
    delete process.env.OPENROUTER_API_KEY;
    expect(hasOpenRouterKeys()).toBe(false);
    expect(() => new ApiKeyEngine()).toThrow(/Falta OPENROUTER_API_KEYS/);
  });

  it("rota claves configuradas", () => {
    process.env.OPENROUTER_API_KEYS = "uno,dos";
    const engine = new ApiKeyEngine();
    expect(engine.keyCount).toBe(2);
    expect(engine.getKey()).toBe("uno");
    expect(engine.getKey()).toBe("dos");
  });
});
