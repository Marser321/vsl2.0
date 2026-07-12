import { describe, expect, it } from "vitest";
import type { Document } from "@/db/schema";
import { renderDocument } from "./prompts";

const document = {
  id: 1,
  title: "Ejemplar",
  kind: "winning_script",
  tags: ["promovido"],
  extractedText: "Texto del guion",
} as Document;

describe("renderDocument", () => {
  it("incluye evidencia solo cuando el contexto la provee", () => {
    expect(renderDocument(document)).not.toContain("evidencia_rendimiento");
    expect(renderDocument(document, "Hook 45%")).toContain(
      "<evidencia_rendimiento>Hook 45%</evidencia_rendimiento>"
    );
  });
});
