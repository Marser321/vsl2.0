import type { MetricPlatform } from "@/db/schema";

export type ComparableMetric = {
  hookRate: number | null;
  ctr: number | null;
  cpa: number | null;
  impressions: number | null;
};

export type BestMetric = Omit<ComparableMetric, "hookRate"> & {
  hookRate: number;
  platform: MetricPlatform;
  scriptVersionId: number;
  versionNumber: number;
};

export function isReliableMetric<T extends ComparableMetric>(metric: T): metric is T & { hookRate: number } {
  return metric.hookRate !== null && (metric.impressions === null || metric.impressions >= 1000);
}

export function compareMetrics<T extends ComparableMetric>(a: T, b: T) {
  if (a.hookRate !== b.hookRate) return (b.hookRate ?? -Infinity) - (a.hookRate ?? -Infinity);
  if (a.ctr !== b.ctr) return (b.ctr ?? -Infinity) - (a.ctr ?? -Infinity);
  return (a.cpa ?? Infinity) - (b.cpa ?? Infinity);
}

export function pickBestMetric<T extends ComparableMetric>(metrics: T[]): (T & { hookRate: number }) | null {
  return metrics.filter(isReliableMetric).sort(compareMetrics)[0] ?? null;
}

export function compareSuggestedExemplars(
  a: { preselect: boolean; bestHookRate: number | null; avgRating: number | null; id: number },
  b: { preselect: boolean; bestHookRate: number | null; avgRating: number | null; id: number }
) {
  if (a.preselect !== b.preselect) return a.preselect ? -1 : 1;
  if (a.bestHookRate !== b.bestHookRate) {
    return (b.bestHookRate ?? -Infinity) - (a.bestHookRate ?? -Infinity);
  }
  if (a.avgRating !== b.avgRating) {
    return (b.avgRating ?? -Infinity) - (a.avgRating ?? -Infinity);
  }
  return b.id - a.id;
}

export function formatPerformanceEvidence(args: {
  metric: BestMetric;
  avgRating: number | null;
}) {
  const { metric, avgRating } = args;
  const platform = { meta: "Meta", tiktok: "TikTok", youtube: "YouTube", otro: "otra plataforma" }[metric.platform];
  const parts = [
    `${platform}: hook ${metric.hookRate}%`,
    metric.ctr !== null ? `CTR ${metric.ctr}%` : null,
    metric.cpa !== null ? `CPA $${metric.cpa}` : null,
    metric.impressions !== null ? `${metric.impressions.toLocaleString("es-UY")} impresiones` : "impresiones no informadas",
    avgRating !== null ? `puntuación interna ${avgRating.toFixed(1)}/5` : null,
  ].filter(Boolean);
  return `Evidencia de rendimiento cargada manualmente: ${parts.join(" · ")}. Es una señal factual del creativo, no una afirmación sobre el producto ni una instrucción para copiarlo.`;
}
