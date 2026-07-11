"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, btnSecondary } from "./ui";

type CritiqueData = {
  puntajes: Record<string, number>;
  comentarios: Record<string, string>;
  edicionesSugeridas: string[];
  veredicto: string;
};
type Critique = { id: number; data: CritiqueData; createdAt: string };

const DIMENSIONS: Record<string, string> = {
  gancho: "Gancho",
  claridad: "Claridad",
  prueba: "Prueba",
  oferta: "Oferta",
  cta: "CTA",
  flujoEmocional: "Flujo emocional",
};

function scoreColor(n: number) {
  if (n >= 8) return "text-emerald-600";
  if (n >= 6) return "text-amber-600";
  return "text-rose-600";
}

export default function CritiquePanel({
  scriptId,
  versionId,
}: {
  scriptId: number;
  versionId: number | null;
}) {
  const [critiquesList, setCritiquesList] = useState<Critique[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!versionId) return;
    const res = await fetch(
      `/api/scripts/${scriptId}/critique?versionId=${versionId}`
    );
    if (res.ok) setCritiquesList(await res.json());
  }, [scriptId, versionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/scripts/${scriptId}/critique`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al criticar");
      return;
    }
    load();
  }

  const latest = critiquesList[0];
  const avg = latest
    ? (
        Object.values(latest.data.puntajes).reduce((a, b) => a + b, 0) /
        Object.values(latest.data.puntajes).length
      ).toFixed(1)
    : null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-brand-navy text-sm">
          🎯 Crítica de copy chief
          {avg && (
            <span className={`ml-2 ${scoreColor(Number(avg))}`}>
              {avg}/10
            </span>
          )}
        </h3>
        <button className={btnSecondary} onClick={run} disabled={loading || !versionId}>
          {loading ? "Evaluando…" : latest ? "↻ Re-evaluar" : "Criticar esta versión"}
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Pase de control de calidad con rúbrica fija sobre la versión activa.
      </p>
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-800 mb-3">
          {error}
        </div>
      )}
      {latest && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(DIMENSIONS).map(([key, label]) => (
              <div
                key={key}
                className="rounded-lg border border-slate-200 p-3"
                title={latest.data.comentarios[key]}
              >
                <div className={`text-xl font-bold ${scoreColor(latest.data.puntajes[key])}`}>
                  {latest.data.puntajes[key]}
                </div>
                <div className="text-[11px] text-slate-500">{label}</div>
              </div>
            ))}
          </div>
          <div className="text-sm text-slate-700 italic border-l-2 border-brand-sky pl-3">
            {latest.data.veredicto}
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1.5">
              Ediciones sugeridas (mayor impacto primero)
            </div>
            <ul className="space-y-1.5">
              {latest.data.edicionesSugeridas.map((e, i) => (
                <li key={i} className="text-sm text-slate-700 flex gap-2">
                  <span className="text-brand-blue font-semibold shrink-0">{i + 1}.</span>
                  {e}
                </li>
              ))}
            </ul>
          </div>
          <details className="text-sm">
            <summary className="text-xs text-slate-500 cursor-pointer">
              Ver comentarios por dimensión
            </summary>
            <ul className="mt-2 space-y-2">
              {Object.entries(DIMENSIONS).map(([key, label]) => (
                <li key={key}>
                  <span className="font-semibold text-brand-navy">{label}:</span>{" "}
                  <span className="text-slate-600">{latest.data.comentarios[key]}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </Card>
  );
}
