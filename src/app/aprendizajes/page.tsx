"use client";

import { useEffect, useState } from "react";
import { Badge, Card, PageTitle, btnPrimary, btnSecondary } from "@/components/ui";
import { BarChart3, Brain, Star } from "lucide-react";

type Learning = { id: number; industry: string; subindustry: string | null; content: string; evidenceCount: number; isActive: boolean; createdAt: string };

type StatRow = { n: number; avgScore: number; wonRate: number };
type Stats = {
  totalRatings: number;
  byFramework: Array<StatRow & { frameworkId: number | null; name: string }>;
  byProvider: Array<StatRow & { provider: string }>;
  byFormat: Array<StatRow & { format: string }>;
};
type PrefsInfo = {
  doc: { id: number; title: string; createdAt: string; tokenCount: number } | null;
  totalRatings: number;
  minRatings: number;
};

function StarCell({ avg }: { avg: number }) {
  const color = avg >= 4 ? "text-emerald-600" : avg >= 3 ? "text-amber-600" : "text-rose-600";
  return <span className={`inline-flex items-center gap-1 font-semibold ${color}`}><Star size={14} strokeWidth={1.75} />{avg.toFixed(1)}</span>;
}

export default function LearningsPage() {
  const [rows, setRows] = useState<Learning[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [prefs, setPrefs] = useState<PrefsInfo | null>(null);
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenMsg, setRegenMsg] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/industry-learnings");
    setRows(await response.json());
  }
  async function loadStats() {
    const [s, p] = await Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/team-preferences").then((r) => r.json()),
    ]);
    setStats(s);
    setPrefs(p);
  }
  useEffect(() => {
    load();
    loadStats();
  }, []);

  async function toggle(row: Learning) {
    setBusy(row.id);
    await fetch("/api/industry-learnings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, active: !row.isActive }) });
    setBusy(null);
    await load();
  }

  async function regenerate() {
    if (
      !confirm(
        "Regenerar las preferencias del equipo sintetiza las puntuaciones en un documento global que entra al contexto de TODAS las generaciones. Invalida el caché de prompt una vez (la próxima generación es algo más cara/lenta). ¿Continuar?"
      )
    )
      return;
    setRegenBusy(true);
    setRegenMsg(null);
    const res = await fetch("/api/team-preferences", { method: "POST" });
    const data = await res.json();
    setRegenBusy(false);
    if (!res.ok) {
      setRegenMsg(data.error || "Error al regenerar");
      return;
    }
    setRegenMsg(`Preferencias regeneradas a partir de ${data.basedOn} puntuaciones.`);
    loadStats();
  }

  return (
    <div>
      <PageTitle
        title="Aprendizajes y puntuaciones"
        subtitle="El loop de mejora: las puntuaciones del equipo alimentan estadísticas, preferencias y reglas por rubro"
      />

      {stats && stats.totalRatings > 0 && (
        <Card className="p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-brand-navy text-sm">
              <BarChart3 className="mr-2 inline" size={16} strokeWidth={1.75} /> Qué está funcionando ({stats.totalRatings} puntuaciones)
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-xs font-semibold text-slate-500 mb-2">Por framework</div>
              <table className="w-full text-sm">
                <tbody>
                  {[...stats.byFramework]
                    .sort((a, b) => b.avgScore - a.avgScore)
                    .map((r) => (
                      <tr key={`${r.frameworkId}`} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2">{r.name}</td>
                        <td className="py-1.5 text-right">
                          <StarCell avg={r.avgScore} />
                        </td>
                        <td className="py-1.5 text-right text-xs text-slate-400 w-16">{r.n} usos</td>
                        <td className="py-1.5 text-right text-xs text-slate-400 w-20">
                          {Math.round(r.wonRate * 100)}% ganó
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">Por formato</div>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.byFormat.map((r) => (
                      <tr key={r.format} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2">{r.format === "reel" ? "Reel" : "VSL"}</td>
                        <td className="py-1.5 text-right">
                          <StarCell avg={r.avgScore} />
                        </td>
                        <td className="py-1.5 text-right text-xs text-slate-400 w-16">{r.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">Por proveedor</div>
                <table className="w-full text-sm">
                  <tbody>
                    {stats.byProvider.map((r) => (
                      <tr key={r.provider} className="border-t border-slate-100">
                        <td className="py-1.5 pr-2">{r.provider}</td>
                        <td className="py-1.5 text-right">
                          <StarCell avg={r.avgScore} />
                        </td>
                        <td className="py-1.5 text-right text-xs text-slate-400 w-16">{r.n}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5 mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="font-semibold text-brand-navy text-sm">
              <Brain className="mr-2 inline" size={16} strokeWidth={1.75} /> Preferencias aprendidas del equipo
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {prefs?.doc
                ? `Documento activo generado el ${new Date(prefs.doc.createdAt).toLocaleDateString("es-UY")} (${prefs.doc.tokenCount} tokens). Entra al contexto de todas las generaciones.`
                : `Todavía no existe. Con ${prefs?.minRatings ?? 5}+ puntuaciones se puede sintetizar un documento de reglas y anti-patrones que entra a todas las generaciones.`}
              {prefs && ` Puntuaciones acumuladas: ${prefs.totalRatings}.`}
            </p>
            {regenMsg && <p className="text-xs mt-2 text-emerald-700">{regenMsg}</p>}
          </div>
          <button
            className={btnPrimary}
            onClick={regenerate}
            disabled={regenBusy || (prefs !== null && prefs.totalRatings < (prefs.minRatings ?? 5))}
            title={
              prefs !== null && prefs.totalRatings < (prefs.minRatings ?? 5)
                ? `Se necesitan al menos ${prefs.minRatings} puntuaciones`
                : undefined
            }
          >
            {regenBusy ? "Sintetizando…" : prefs?.doc ? "↻ Regenerar preferencias" : "Generar preferencias"}
          </button>
        </div>
      </Card>

      <h2 className="font-semibold text-brand-navy text-sm mb-3">Reglas por rubro (aprobación manual)</h2>
      <Card>
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">Todavía no hay aprendizajes extraídos.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((row) => (
              <li key={row.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge tone={row.isActive ? "green" : "yellow"}>{row.isActive ? "Aprobado" : "Pendiente"}</Badge>
                      <span className="text-xs font-semibold text-slate-500">
                        {row.industry}
                        {row.subindustry ? ` / ${row.subindustry}` : ""}
                      </span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-700">{row.content}</p>
                    <p className="mt-2 text-[10px] text-slate-400">
                      Evidencia: {row.evidenceCount} caso · {new Date(row.createdAt).toLocaleDateString("es-UY")}
                    </p>
                  </div>
                  <button disabled={busy === row.id} onClick={() => toggle(row)} className={btnSecondary}>
                    {row.isActive ? "Desactivar" : "Aprobar"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
