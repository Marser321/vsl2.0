import { describe, expect, it } from "vitest";
import { pickWinningCandidate, type VersionMetric } from "./MetricsPanel";

function metric(overrides: Partial<VersionMetric>): VersionMetric {
  return {
    id: 1,
    scriptVersionId: 1,
    versionNumber: 1,
    platform: "meta",
    hookRate: 30,
    ctr: 1,
    cpa: 20,
    impressions: 1000,
    notes: null,
    capturedAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("pickWinningCandidate", () => {
  it("prioriza hook rate, luego CTR y finalmente el CPA menor", () => {
    const metrics = [
      metric({ id: 1, versionNumber: 1, hookRate: 40, ctr: 1.5, cpa: 12 }),
      metric({ id: 2, versionNumber: 2, hookRate: 40, ctr: 1.7, cpa: 18 }),
      metric({ id: 3, versionNumber: 3, hookRate: 40, ctr: 1.7, cpa: 10 }),
    ];

    expect(pickWinningCandidate(metrics)?.versionNumber).toBe(3);
  });

  it("descarta muestras menores a 1000 impresiones, pero acepta impresiones vacías", () => {
    const metrics = [
      metric({ id: 1, versionNumber: 1, hookRate: 60, impressions: 999 }),
      metric({ id: 2, versionNumber: 2, hookRate: 45, impressions: null }),
    ];

    expect(pickWinningCandidate(metrics)?.versionNumber).toBe(2);
  });
});
