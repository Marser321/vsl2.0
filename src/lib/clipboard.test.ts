import { describe, expect, it, vi } from "vitest";
import { copyText } from "./clipboard";

describe("copyText", () => {
  it("espera la confirmación del portapapeles", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    await copyText("texto", { writeText });
    expect(writeText).toHaveBeenCalledWith("texto");
  });

  it("propaga el fallo para mostrar una alternativa manual", async () => {
    await expect(copyText("texto", undefined)).rejects.toThrow("no está disponible");
  });
});
