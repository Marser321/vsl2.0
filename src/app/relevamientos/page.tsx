"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, PageTitle, Skeleton, btnPrimary, btnSecondary, inputCls } from "@/components/ui";

type IntakeRow = { id: string; title: string; status: string; clientName: string | null; brandName: string | null; createdAt: string; submittedAt: string | null };
type Client = { id: number; name: string };

const statusLabel: Record<string, string> = { draft: "Borrador", submitted: "Entregado", in_review: "En revisión", changes_requested: "Cambios pedidos", approved: "Aprobado", expired: "Vencido", revoked: "Revocado" };
const statusTone: Record<string, "gray" | "blue" | "green" | "red" | "yellow"> = { draft: "gray", submitted: "blue", in_review: "yellow", changes_requested: "yellow", approved: "green", expired: "red", revoked: "red" };

export default function IntakesPage() {
  const [rows, setRows] = useState<IntakeRow[]>([]); const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [createdUrl, setCreatedUrl] = useState(""); const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  async function load() { try { const [a, b] = await Promise.all([fetch("/api/intakes"), fetch("/api/clients")]); setRows(await a.json()); setClients(await b.json()); } finally { setLoaded(true); } }
  useEffect(() => { load(); }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setCreatedUrl("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/intakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: Number(form.get("clientId")), title: form.get("title") }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setError(data.error);
    setCreatedUrl(data.accessUrl); await navigator.clipboard?.writeText(data.accessUrl); await load();
  }

  return <div><PageTitle title="Relevamientos" subtitle="Dossiers de marca y campaña antes de redactar" actions={<button className={btnPrimary} onClick={() => setOpen(!open)}>+ Nuevo enlace</button>} />
    {open && <Card className="mb-6 p-5"><form onSubmit={create} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] items-end"><label><span className="mb-1 block text-xs font-semibold text-slate-600">Cliente</span><select name="clientId" required className={inputCls}><option value="">Elegí…</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label><span className="mb-1 block text-xs font-semibold text-slate-600">Nombre del relevamiento</span><input name="title" required className={inputCls} placeholder="Ej: Lanzamiento programa premium" /></label><button className={btnPrimary} disabled={busy}>{busy ? "Creando…" : "Crear y copiar"}</button></form>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}{createdUrl && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-800">Enlace copiado. Guardalo ahora: el secreto no vuelve a mostrarse.</p><div className="mt-1 break-all font-mono text-xs text-emerald-700">{createdUrl}</div><button onClick={() => navigator.clipboard.writeText(createdUrl)} className={`${btnSecondary} mt-2`}>Copiar otra vez</button></div>}</Card>}
    <Card>{!loaded ? <div className="divide-y divide-slate-100">{Array.from({ length: 5 }).map((_, index) => <div className="flex gap-4 px-5 py-4" key={index}><div className="flex-1"><Skeleton className="h-4 w-52" /><Skeleton className="mt-2 h-3 w-32" /></div><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="h-4 w-20" /></div>)}</div> : rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-400">No hay relevamientos todavía.</div> : <ul className="divide-y divide-slate-100">{rows.map((row) => <li key={row.id}><Link href={`/relevamientos/${row.id}`} className="flex items-center gap-4 px-5 py-4 hover:bg-brand-mist"><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-brand-navy">{row.title}</div><div className="mt-1 text-xs text-slate-500">{row.clientName ?? "Sin cliente"}{row.brandName ? ` · ${row.brandName}` : ""}</div></div><Badge tone={statusTone[row.status] ?? "gray"}>{statusLabel[row.status] ?? row.status}</Badge><time className="text-xs text-slate-400">{new Date(row.createdAt).toLocaleDateString("es-UY")}</time></Link></li>)}</ul>}</Card>
  </div>;
}
