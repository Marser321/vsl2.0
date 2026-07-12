"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ScriptMarkdown from "@/components/ScriptMarkdown";
import { Badge, Card, ConfirmDialog, EmptyState, PageTitle, Skeleton, btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import { analyzeScript, fmtTime } from "@/lib/readtime";
import { Clapperboard, LayoutTemplate, Pencil, Smartphone, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

type Template = {
  id: number;
  slug: string;
  title: string;
  format: "vsl" | "reel";
  frameworkId: number | null;
  frameworkName: string | null;
  description: string | null;
  briefDefaults: Record<string, unknown>;
  contentMd: string;
  isBuiltin: boolean;
};

type Client = { id: number; name: string };

function TemplateCard({
  template,
  clients,
  onUsed,
  onDeleted,
}: {
  template: Template;
  clients: Client[];
  onUsed: (scriptId: number) => void;
  onDeleted: () => void;
}) {
  const [preview, setPreview] = useState(false);
  const [clientId, setClientId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const stats = useMemo(() => analyzeScript(template.contentMd, 150), [template.contentMd]);

  async function use() {
    if (!clientId) {
      setError("Elegí un cliente para crear el guion");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/templates/${template.id}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Error al usar la plantilla");
      return;
    }
    onUsed(data.scriptId);
  }

  async function remove() {
    const response = await fetch(`/api/templates/${template.id}`, { method: "DELETE" });
    if (!response.ok) {
      toast.error("No se pudo eliminar la plantilla");
      return;
    }
    setDeleteOpen(false);
    toast.success("Plantilla eliminada");
    onDeleted();
  }

  return (
    <>
    <Card className="p-5">
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-brand-navy">{template.title}</span>
            <Badge tone={template.format === "reel" ? "violet" : "blue"}>
              {template.format === "reel" ? "Reel" : "VSL"}
            </Badge>
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {template.frameworkName ?? "Estructura libre"} ·{" "}
            {stats.totalWords.toLocaleString("es")} palabras · ~{fmtTime(stats.totalSec)}
            {!template.isBuiltin && " · propia"}
          </div>
          {template.description && (
            <p className="text-xs text-slate-600 mt-2">{template.description}</p>
          )}
        </div>
        {!template.isBuiltin && (
          <button
            className="text-xs text-slate-400 hover:text-rose-600 shrink-0"
            onClick={() => setDeleteOpen(true)}
            title="Eliminar plantilla"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mt-4 flex-wrap">
        <select
          className={`${inputCls} !w-auto`}
          value={clientId}
          onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
        >
          <option value="">Cliente…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className={btnPrimary} onClick={use} disabled={busy}>
          {busy ? "Creando…" : <><Pencil size={16} strokeWidth={1.75} /> Usar plantilla</>}
        </button>
        <Link href={`/generar?templateId=${template.id}`} className={btnSecondary}>
          <Sparkles size={16} strokeWidth={1.75} /> Usar en generador
        </Link>
        <button
          className="text-xs text-brand-blue hover:underline ml-auto"
          onClick={() => setPreview((p) => !p)}
        >
          {preview ? "Ocultar vista previa" : "Vista previa"}
        </button>
      </div>
      {error && <div className="text-xs text-rose-600 mt-2">{error}</div>}

      {preview && (
        <div className="mt-4 max-h-[40vh] overflow-y-auto rounded-lg border border-slate-200 bg-brand-mist p-4">
          <ScriptMarkdown content={template.contentMd} />
        </div>
      )}
    </Card>
    <ConfirmDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={remove} title="Eliminar plantilla" message={<>¿Eliminar la plantilla <strong>“{template.title}”</strong>? Esta acción no se puede deshacer.</>} confirmLabel="Eliminar" destructive />
    </>
  );
}

export default function PlantillasPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    try {
      const data = await (await fetch("/api/templates")).json();
      setRows(data);
    } finally {
      setLoaded(true);
    }
  }
  useEffect(() => {
    load();
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  const vsl = rows.filter((t) => t.format === "vsl");
  const reels = rows.filter((t) => t.format === "reel");

  return (
    <div className="max-w-5xl">
      <PageTitle
        title="Plantillas"
        subtitle="Estructuras probadas listas para completar en el editor — con marcadores {{ }} que se rellenan solos con los datos del cliente"
      />
      {!loaded ? (
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 4 }).map((_, index) => <Card className="p-5" key={index}><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-5 h-9 w-full" /></Card>)}</div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={LayoutTemplate} title="No hay plantillas" description={<>Corré <code className="text-brand-blue">npm run db:seed-corpus</code> para cargar las plantillas base, o guardá un guion como plantilla desde su página.</>} /></Card>
      ) : null}
      {vsl.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 font-semibold text-brand-navy text-sm mb-3"><Clapperboard size={17} strokeWidth={1.75} />VSL</h2>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {vsl.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                clients={clients}
                onUsed={(id) => router.push(`/guiones/${id}?edit=1`)}
                onDeleted={load}
              />
            ))}
          </div>
        </>
      )}
      {reels.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 font-semibold text-brand-navy text-sm mb-3"><Smartphone size={17} strokeWidth={1.75} />Reels</h2>
          <div className="grid grid-cols-2 gap-4">
            {reels.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                clients={clients}
                onUsed={(id) => router.push(`/guiones/${id}?edit=1`)}
                onDeleted={load}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
