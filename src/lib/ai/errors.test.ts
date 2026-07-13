import { describe, expect, it } from "vitest";
import { sanitizeAiError } from "./errors";

describe("sanitizeAiError", () => {
  it("elimina claves parciales de los errores del proveedor", () => {
    const message = sanitizeAiError(new Error("401 Incorrect API key: sk-proj-********ABCD. Revisá la clave."));
    expect(message).toBe("401 Incorrect API key: [clave redactada] Revisá la clave.");
    expect(message).not.toContain("ABCD");
  });
});
