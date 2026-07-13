import { describe, expect, it } from "vitest";
import { effectiveScriptStatus, GENERATION_STALE_MS } from "./status";

describe("effectiveScriptStatus", () => {
  it("mantiene activa una generación con heartbeat reciente", () => {
    expect(effectiveScriptStatus("generating", new Date(10_000), 10_000 + GENERATION_STALE_MS - 1)).toBe("generating");
  });

  it("marca como interrumpida una generación sin heartbeat vigente", () => {
    expect(effectiveScriptStatus("generating", new Date(10_000), 10_000 + GENERATION_STALE_MS + 1)).toBe("interrupted");
    expect(effectiveScriptStatus("generating", null)).toBe("interrupted");
  });
});
