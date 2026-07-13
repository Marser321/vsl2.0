"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Button, Card, CopyButton, EmptyState, PageTitle, Skeleton, btnPrimary, inputCls } from "@/components/ui";
import { copyText } from "@/lib/clipboard";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";

type IntakeRow = { id: string; title: string; status: string; clientName: string | null; brandName: string | null; createdAt: string; submittedAt: string | null };
type Client = { id: number; name: string };

const statusLabel: Record<string, string> = { draft: "Borrador", submitted: "Entregado", in_review: "En revisión", changes_requested: "Cambios pedidos", approved: "Aprobado", expired: "Vencido", revoked: "Revocado" };
const statusTone: Record<string, "gray" | "blue" | "green" | "red" | "yellow"> = { draft: "gray", submitted: "blue", in_review: "yellow", changes_requested: "yellow", approved: "green", expired: "red", revoked: "red" };

export default function IntakesPage() {
  const [rows, setRows] = useState<IntakeRow[]>([]); const [clients, setClients] = useState<Client[]>([]);
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false); const [createdUrl, setCreatedUrl] = useState(""); const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  async function load() { try { const [a, b] = await Promise.all([fetch("/api/intakes"), fetch("/api/clients")]); setRows(await a.json()); setClients(await b.json()); } finally { setLoaded(true); } }
  useEffect(() => { load(); }, []);
  useEffect(() => {
    const clientId = new URLSearchParams(window.location.search).get("clientId");
    if (clientId) {
      setSelectedClientId(clientId);
      setOpen(true);
    }
  }, []);

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setCreatedUrl("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/intakes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ clientId: Number(form.get("clientId")), title: form.get("title") }) });
    const data = await response.json(); setBusy(false);
    if (!response.ok) return setError(data.error);
    setCreatedUrl(data.accessUrl);
    try {
      await copyText(data.accessUrl);
      toast.success("Enlace creado y copiado");
    } catch {
      toast.warning("Enlace creado. Copialo manualmente antes de cerrar esta pantalla.");
    }
    await load();
  }

  return <div><PageTitle title="Relevamientos" subtitle="Dossiers de marca, oferta y campaña antes de redactar" actions={<button className={btnPrimary} onClick={() => setOpen(!open)}>+ Nuevo relevamiento</button>} />
    {open && <Card className="mb-6 p-5"><div className="mb-4"><h2 className="font-semibold text-brand-navy">Crear relevamiento</h2><p className="mt-1 text-xs text-slate-500">Genera un enlace privado para el cliente. Al revisar y aprobar sus respuestas se crearán marca, oferta y campaña.</p></div><form onSubmit={create} className="grid gap-4 sm:grid-cols-[1fr_2fr_auto] items-end"><label><span className="mb-1 block text-xs font-semibold text-slate-600">Cliente</span><select name="clientId" required className={inputCls} value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)}><option value="">Elegí…</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label><span className="mb-1 block text-xs font-semibold text-slate-600">Nombre del relevamiento</span><input name="title" required className={inputCls} placeholder="Ej: Lanzamiento programa premium" /></label><Button type="submit" loading={busy} loadingLabel="Creando…">Crear enlace privado</Button></form>{error && <p className="mt-3 text-sm text-rose-600">{error}</p>}{createdUrl && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-xs font-semibold text-emerald-800">Enlace creado. Guardalo ahora: el secreto no vuelve a mostrarse.</p><div className="mt-1 break-all font-mono text-xs text-emerald-700">{createdUrl}</div><CopyButton text={createdUrl} label="Copiar otra vez" copiedLabel="Enlace copiado" className="mt-2" /></div>}</Card>}
    <Card>{!loaded ? <div className="divide-y divide-slate-100">{Array.from({ length: 5 }).map((_, index) => <div className="flex gap-4 px-5 py-4" key={index}><div className="flex-1"><Skeleton className="h-4 w-52" /><Skeleton className="mt-2 h-3 w-32" /></div><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="h-4 w-20" /></div>)}</div> : rows.length === 0 ? <EmptyState icon={ClipboardList} title="Todavía no hay relevamientos" description="Creá un enlace privado, pedile al cliente que complete el dossier y aprobalo para generar con marca, oferta y campaña verificadas." action={<button className={btnPrimary} onClick={() => setOpen(true)}>Crear el primero</button>} /> : <ul className="divide-y divide-slate-100">{rows.map((row) => <li key={row.id}><Link href={`/relevamientos/${row.id}`} className="flex flex-wrap items-center gap-3 px-4 py-4 hover:bg-brand-mist sm:flex-nowrap sm:px-5"><div className="min-w-48 flex-1"><div className="truncate text-sm font-semibold text-brand-navy">{row.title}</div><div className="mt-1 text-xs text-slate-500">{row.clientName ?? "Sin cliente"}{row.brandName ? ` · ${row.brandName}` : ""}</div></div><Badge tone={statusTone[row.status] ?? "gray"}>{statusLabel[row.status] ?? row.status}</Badge><time className="text-xs text-slate-400">{new Date(row.createdAt).toLocaleDateString("es-UY")}</time></Link></li>)}</ul>}</Card>
  </div>;
}
