import { describe, expect, it } from "vitest";
import { shouldCoalesce } from "./versions";

describe("shouldCoalesce", () => {
  const manual = { id: 7, source: "manual" as const };

  it("coalesce cuando la última es manual, se editaba esa versión y no tiene dependientes", () => {
    expect(shouldCoalesce(manual, 7, false)).toBe(true);
  });

  it("no coalesce sobre versiones de IA ni de plantilla", () => {
    expect(shouldCoalesce({ id: 7, source: "ai" }, 7, false)).toBe(false);
    expect(shouldCoalesce({ id: 7, source: "template" }, 7, false)).toBe(false);
  });

  it("no coalesce si el cliente editaba otra versión (o no mandó base)", () => {
    expect(shouldCoalesce(manual, 3, false)).toBe(false);
    expect(shouldCoalesce(manual, undefined, false)).toBe(false);
  });

  it("no coalesce si la versión tiene crítica o puntuación asociada", () => {
    expect(shouldCoalesce(manual, 7, true)).toBe(false);
  });
});
