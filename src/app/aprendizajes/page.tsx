"use client";

import { useEffect, useState } from "react";
import { Badge, Card, PageTitle, btnSecondary } from "@/components/ui";

type Learning = { id: number; industry: string; subindustry: string | null; content: string; evidenceCount: number; isActive: boolean; createdAt: string };

export default function LearningsPage() {
  const [rows, setRows] = useState<Learning[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  async function load() { const response = await fetch("/api/industry-learnings"); setRows(await response.json()); }
  useEffect(() => { load(); }, []);
  async function toggle(row: Learning) { setBusy(row.id); await fetch("/api/industry-learnings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: row.id, active: !row.isActive }) }); setBusy(null); await load(); }
  return <div><PageTitle title="Aprendizajes por rubro" subtitle="Solo los aprobados entran al contexto de otras marcas del mismo rubro" /><Card>{rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">Todavía no hay aprendizajes extraídos.</div> : <ul className="divide-y divide-slate-100">{rows.map((row) => <li key={row.id} className="p-5"><div className="flex items-start gap-3"><div className="flex-1"><div className="flex items-center gap-2"><Badge tone={row.isActive ? "green" : "yellow"}>{row.isActive ? "Aprobado" : "Pendiente"}</Badge><span className="text-xs font-semibold text-slate-500">{row.industry}{row.subindustry ? ` / ${row.subindustry}` : ""}</span></div><p className="mt-3 text-sm leading-6 text-slate-700">{row.content}</p><p className="mt-2 text-[10px] text-slate-400">Evidencia: {row.evidenceCount} caso · {new Date(row.createdAt).toLocaleDateString("es-UY")}</p></div><button disabled={busy === row.id} onClick={() => toggle(row)} className={btnSecondary}>{row.isActive ? "Desactivar" : "Aprobar"}</button></div></li>)}</ul>}</Card></div>;
}
