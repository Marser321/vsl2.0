"use client";

import { useCallback, useEffect, useState } from "react";
import { BarChart3, CheckCircle2, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Card, btnPrimary, inputCls } from "./ui";

const PLATFORMS = ["meta", "tiktok", "youtube", "otro"] as const;
type Platform = (typeof PLATFORMS)[number];

const PLATFORM_LABELS: Record<Platform, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  youtube: "YouTube",
  otro: "Otro",
};

export type VersionMetric = {
  id: number;
  scriptVersionId: number;
  versionNumber: number;
  platform: Platform;
  hookRate: number | null;
  ctr: number | null;
  cpa: number | null;
  impressions: number | null;
  notes: string | null;
  capturedAt: string;
  updatedAt: string;
};

type MetricsPanelProps = {
  scriptId: number;
  activeVersion: { id: number; versionNumber: number };
  promotions: Array<{ versionId: number | null; scope: "client" | "global" }>;
  onPromote: (versionId: number) => Promise<boolean>;
};

type MetricForm = {
  hookRate: string;
  ctr: string;
  cpa: string;
  impressions: string;
  notes: string;
};

const EMPTY_FORM: MetricForm = {
  hookRate: "",
  ctr: "",
  cpa: "",
  impressions: "",
  notes: "",
};

export function pickWinningCandidate(metrics: VersionMetric[]) {
  return metrics
    .filter(
      (metric) =>
        metric.hookRate !== null &&
        (metric.impressions === null || metric.impressions >= 1000)
    )
    .sort((a, b) => {
      if (a.hookRate !== b.hookRate) return (b.hookRate ?? -Infinity) - (a.hookRate ?? -Infinity);
      if (a.ctr !== b.ctr) return (b.ctr ?? -Infinity) - (a.ctr ?? -Infinity);
      return (a.cpa ?? Infinity) - (b.cpa ?? Infinity);
    })[0] ?? null;
}

function numberOrNull(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function metricSummary(metric: VersionMetric) {
  const parts = [
    metric.hookRate !== null ? `hook ${metric.hookRate}%` : null,
    metric.ctr !== null ? `CTR ${metric.ctr}%` : null,
    metric.cpa !== null ? `CPA $${metric.cpa}` : null,
    metric.impressions !== null
      ? `${metric.impressions.toLocaleString("es-UY")} imp.`
      : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function MetricsPanel({ scriptId, activeVersion, promotions, onPromote }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<VersionMetric[]>([]);
  const [platform, setPlatform] = useState<Platform>("meta");
  const [form, setForm] = useState<MetricForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promoting, setPromoting] = useState(false);

  const loadMetrics = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/scripts/${scriptId}/metrics`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudieron cargar las métricas");
    setMetrics(data.metrics);
    setLoading(false);
  }, [scriptId]);

  useEffect(() => {
    const controller = new AbortController();
    loadMetrics(controller.signal).catch((error) => {
      if ((error as Error).name !== "AbortError") {
        setLoading(false);
        toast.error((error as Error).message);
      }
    });
    return () => controller.abort();
  }, [loadMetrics]);

  useEffect(() => {
    const current = metrics.find(
      (metric) =>
        metric.scriptVersionId === activeVersion.id && metric.platform === platform
    );
    setForm(
      current
        ? {
            hookRate: current.hookRate?.toString() ?? "",
            ctr: current.ctr?.toString() ?? "",
            cpa: current.cpa?.toString() ?? "",
            impressions: current.impressions?.toString() ?? "",
            notes: current.notes ?? "",
          }
        : EMPTY_FORM
    );
  }, [activeVersion.id, metrics, platform]);

  async function saveMetric() {
    setSaving(true);
    try {
      const response = await fetch(`/api/scripts/${scriptId}/metrics`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: activeVersion.id,
          platform,
          hookRate: numberOrNull(form.hookRate),
          ctr: numberOrNull(form.ctr),
          cpa: numberOrNull(form.cpa),
          impressions: numberOrNull(form.impressions),
          notes: form.notes.trim() || null,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la métrica");
      await loadMetrics();
      toast.success(`Métricas de v${activeVersion.versionNumber} · ${PLATFORM_LABELS[platform]} guardadas`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function promoteCandidate() {
    setPromoting(true);
    try {
      if (!candidate) return;
      const promoted = await onPromote(candidate.scriptVersionId);
      if (promoted) toast.success("Guion promovido como ejemplar");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPromoting(false);
    }
  }

  const candidate = pickWinningCandidate(metrics);
  const candidatePromoted = candidate
    ? promotions.some(
        (promotion) =>
          promotion.versionId === candidate.scriptVersionId && promotion.scope === "client"
      )
    : false;
  const sortedMetrics = [...metrics].sort(
    (a, b) => b.versionNumber - a.versionNumber || a.platform.localeCompare(b.platform)
  );

  return (
    <Card className="mb-4 overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <BarChart3 size={17} className="text-brand-blue" strokeWidth={1.75} />
          <h2 className="text-sm font-semibold text-brand-navy">Métricas reales</h2>
          <span className="text-xs text-slate-400">Meta, TikTok, YouTube u otra fuente</span>
        </div>
      </div>

      {candidate && (
        <div className="flex flex-wrap items-center gap-3 border-b border-emerald-200 bg-emerald-50 px-5 py-3">
          <Trophy size={17} className="text-emerald-700" strokeWidth={1.75} />
          <p className="min-w-0 flex-1 text-sm text-emerald-900">
            La v{candidate.versionNumber} tiene las mejores métricas reales — promovela como ejemplar
          </p>
          {candidatePromoted ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 size={14} /> Ya promovida para el cliente
            </span>
          ) : (
            <button className={btnPrimary} onClick={promoteCandidate} disabled={promoting}>
              {promoting ? "Promoviendo…" : "Promover como ejemplar"}
            </button>
          )}
        </div>
      )}

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_1.35fr]">
        <section aria-labelledby="metricas-cargadas-title">
          <h3 id="metricas-cargadas-title" className="mb-2 text-xs font-semibold text-slate-600">
            Métricas cargadas
          </h3>
          {loading ? (
            <p className="text-xs text-slate-400">Cargando métricas…</p>
          ) : sortedMetrics.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-xs text-slate-500">
              Todavía no hay datos de campaña para este guion.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedMetrics.map((metric) => {
                const isActive = metric.scriptVersionId === activeVersion.id;
                return (
                  <li
                    key={metric.id}
                    className={`rounded-lg border px-3 py-2 text-xs ${
                      isActive
                        ? "border-brand-blue bg-blue-50 text-brand-navy"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    <span className="font-semibold">
                      v{metric.versionNumber} · {PLATFORM_LABELS[metric.platform]}
                    </span>
                    <span> — {metricSummary(metric)}</span>
                    {metric.notes && <p className="mt-1 text-[11px] text-slate-500">{metric.notes}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="cargar-metricas-title">
          <h3 id="cargar-metricas-title" className="mb-2 text-xs font-semibold text-slate-600">
            Cargar o editar para la v{activeVersion.versionNumber}
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <label className="col-span-2 text-xs text-slate-600 sm:col-span-1">
              Plataforma
              <select
                value={platform}
                onChange={(event) => setPlatform(event.target.value as Platform)}
                className={`${inputCls} mt-1`}
              >
                {PLATFORMS.map((value) => (
                  <option key={value} value={value}>{PLATFORM_LABELS[value]}</option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-600">
              Hook rate %
              <input type="number" min="0" max="100" step="0.1" value={form.hookRate} onChange={(event) => setForm((current) => ({ ...current, hookRate: event.target.value }))} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs text-slate-600">
              CTR %
              <input type="number" min="0" max="100" step="0.1" value={form.ctr} onChange={(event) => setForm((current) => ({ ...current, ctr: event.target.value }))} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs text-slate-600">
              CPA
              <input type="number" min="0" step="0.01" value={form.cpa} onChange={(event) => setForm((current) => ({ ...current, cpa: event.target.value }))} className={`${inputCls} mt-1`} />
            </label>
            <label className="text-xs text-slate-600">
              Impresiones
              <input type="number" min="0" step="1" value={form.impressions} onChange={(event) => setForm((current) => ({ ...current, impressions: event.target.value }))} className={`${inputCls} mt-1`} />
            </label>
            <label className="col-span-2 text-xs text-slate-600 sm:col-span-3">
              Notas
              <textarea rows={2} maxLength={2000} value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className={`${inputCls} mt-1`} placeholder="Ej: campaña de prospección, audiencia fría…" />
            </label>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <button className={btnPrimary} onClick={saveMetric} disabled={saving}>
              {saving ? "Guardando…" : "Guardar métricas"}
            </button>
            {metrics.some((metric) => metric.scriptVersionId === activeVersion.id && metric.platform === platform) && (
              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                <CheckCircle2 size={13} /> Editás el snapshot existente
              </span>
            )}
          </div>
        </section>
      </div>
    </Card>
  );
}
