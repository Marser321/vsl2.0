import { describe, expect, it } from "vitest";
import { compareSuggestedExemplars, formatPerformanceEvidence, pickBestMetric, type BestMetric } from "./quality";

const metric = (overrides: Partial<BestMetric>): BestMetric => ({
  platform: "meta",
  scriptVersionId: 1,
  versionNumber: 1,
  hookRate: 30,
  ctr: 1,
  cpa: 20,
  impressions: 1000,
  ...overrides,
});

describe("quality signals", () => {
  it("elige hook, CTR y CPA en ese orden y descarta muestras chicas", () => {
    const best = pickBestMetric([
      metric({ versionNumber: 1, hookRate: 70, impressions: 999 }),
      metric({ versionNumber: 2, hookRate: 45, ctr: 2, cpa: 15 }),
      metric({ versionNumber: 3, hookRate: 45, ctr: 2, cpa: 9 }),
    ]);
    expect(best?.versionNumber).toBe(3);
  });

  it("mantiene primero los ejemplares preseleccionables", () => {
    const rows = [
      { id: 1, preselect: false, bestHookRate: 60, avgRating: 2 },
      { id: 2, preselect: true, bestHookRate: 40, avgRating: 4 },
    ].sort(compareSuggestedExemplars);
    expect(rows.map((row) => row.id)).toEqual([2, 1]);
  });

  it("redacta evidencia factual sin convertirla en directiva", () => {
    const note = formatPerformanceEvidence({ metric: metric({ hookRate: 46, impressions: null }), avgRating: 2 });
    expect(note).toContain("hook 46%");
    expect(note).toContain("puntuación interna 2.0/5");
    expect(note).toContain("no una afirmación");
  });
});
