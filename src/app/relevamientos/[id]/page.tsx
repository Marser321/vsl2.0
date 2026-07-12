"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { Badge, Card, PageTitle, btnPrimary, btnSecondary } from "@/components/ui";
import { ArrowRight } from "lucide-react";

type Detail = {
  request: { id: string; title: string; status: string; clientId: number | null; brandId: number | null; offerId: number | null; campaignId: number | null; expiresAt: string };
  submission: { answers: Record<string, Record<string, unknown>>; completion: number; summary: Record<string, unknown> | null };
  assets: Array<{ id: string; title: string; status: string; error: string | null; extractedText: string }>;
  client: { name: string } | null;
};

const labels: Record<string, string> = {
  start_review: "Comenzar revisión",
  request_changes: "Pedir cambios",
  approve: "Aprobar dossier",
  revoke: "Revocar enlace",
};

export default function IntakeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/intakes/${id}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) setError(body.error);
    else setData(body);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function action(name: string) {
    setBusy(name);
    setError("");
    const response = await fetch(`/api/intakes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: name }),
    });
    const body = await response.json();
    setBusy("");
    if (!response.ok) return setError(body.error);
    await load();
  }

  if (!data) return <div className="text-sm text-slate-400">{error || "Cargando…"}</div>;
  const { request, submission } = data;
  const actions = request.status === "submitted"
    ? ["start_review", "revoke"]
    : request.status === "in_review"
      ? ["request_changes", "approve", "revoke"]
      : ["draft", "changes_requested"].includes(request.status) ? ["revoke"] : [];

  return (
    <div>
      <PageTitle
        title={request.title}
        subtitle={`${data.client?.name ?? "Cliente"} · ${submission.completion}% completo · ${request.status}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {actions.map((name) => (
              <button key={name} disabled={Boolean(busy)} onClick={() => action(name)} className={name === "approve" ? btnPrimary : btnSecondary}>
                {busy === name ? "Procesando…" : labels[name]}
              </button>
            ))}
            {request.status === "approved" && request.clientId && (
              <Link className={btnPrimary} href={`/generar?clientId=${request.clientId}&brandId=${request.brandId ?? ""}&offerId=${request.offerId ?? ""}&campaignId=${request.campaignId ?? ""}`}>Generar VSL <ArrowRight size={16} strokeWidth={1.75} /></Link>
            )}
          </div>
        }
      />
      {error && <p className="mb-5 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

      {submission.summary && (
        <Card className="mb-6 p-5">
          <h2 className="font-semibold text-brand-navy">Síntesis estratégica</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            {["brandSummary", "offerSummary", "audienceSummary"].map((key) => (
              <div key={key}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{key.replace("Summary", "")}</div>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{String(submission.summary?.[key] ?? "—")}</p>
              </div>
            ))}
          </div>
          {["verifiedClaims", "hypotheses", "gaps"].map((key) => Array.isArray(submission.summary?.[key]) && (
            <div key={key} className="mt-4">
              <div className="text-xs font-semibold text-slate-600">{key}</div>
              <ul className="mt-1 list-disc pl-5 text-sm text-slate-600">{(submission.summary[key] as string[]).map((item) => <li key={item}>{item}</li>)}</ul>
            </div>
          ))}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          {Object.entries(submission.answers ?? {}).map(([section, answers]) => (
            <Card key={section} className="p-5">
              <h2 className="font-semibold capitalize text-brand-navy">{section}</h2>
              <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.entries(answers).filter(([, value]) => value !== "" && value !== false && (!Array.isArray(value) || value.length)).map(([key, value]) => (
                  <div key={key} className="rounded-lg bg-slate-50 p-3">
                    <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{key}</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{Array.isArray(value) ? value.join("\n") : String(value)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          ))}
        </div>
        <div>
          <Card className="sticky top-6 p-5">
            <h2 className="font-semibold text-brand-navy">Materiales ({data.assets.length})</h2>
            <ul className="mt-3 space-y-3">
              {data.assets.map((asset) => (
                <li key={asset.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex gap-2">
                    <span className="flex-1 text-xs font-semibold text-slate-700">{asset.title}</span>
                    <Badge tone={asset.status === "ready" ? "green" : asset.status === "failed" ? "red" : "yellow"}>{asset.status}</Badge>
                  </div>
                  {asset.error && <p className="mt-2 text-xs text-amber-700">{asset.error}</p>}
                  <p className="mt-2 line-clamp-4 text-xs leading-5 text-slate-500">{asset.extractedText || "Sin contenido extraído"}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
