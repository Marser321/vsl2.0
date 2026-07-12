"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import DocumentManager from "@/components/DocumentManager";
import { Badge, Card, PageTitle, Skeleton, btnPrimary, btnSecondary, inputCls } from "@/components/ui";
import { Radar, Sparkles } from "lucide-react";

type Client = {
  id: number;
  name: string;
  industry: string | null;
  description: string | null;
  notes: string | null;
};

type ScriptRow = {
  id: number;
  title: string;
  outcome: string;
  status: string;
  createdAt: string;
};

type RadarDoc = { id: number; title: string; createdAt: string };

export default function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [radar, setRadar] = useState<RadarDoc | null>(null);
  const [radarBusy, setRadarBusy] = useState(false);
  const [radarErr, setRadarErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, s, docs] = await Promise.all([
      fetch(`/api/clients/${id}`).then((r) => r.json()),
      fetch(`/api/scripts?clientId=${id}`).then((r) => r.json()),
      fetch(`/api/documents?clientId=${id}`).then((r) => r.json()),
    ]);
    setClient(c);
    setScripts(s);
    const radarDoc = Array.isArray(docs)
      ? docs.find(
          (d: { isActive: boolean; tags: string[] }) =>
            d.isActive && Array.isArray(d.tags) && d.tags.includes("radar")
        )
      : null;
    setRadar(radarDoc ?? null);
  }, [id]);

  async function updateRadar() {
    setRadarBusy(true);
    setRadarErr(null);
    const res = await fetch(`/api/clients/${id}/radar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setRadarBusy(false);
    if (!res.ok) {
      setRadarErr(data.error || "Error al actualizar el radar");
      return;
    }
    load();
  }

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        industry: fd.get("industry"),
        description: fd.get("description"),
        notes: fd.get("notes"),
      }),
    });
    setEditing(false);
    load();
  }

  if (!client) return <div aria-label="Cargando cliente"><Skeleton className="h-8 w-56" /><Skeleton className="mt-2 h-4 w-32" /><div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-2"><Card className="p-5"><Skeleton className="h-5 w-36" /><Skeleton className="mt-5 h-40 w-full" /></Card><Card className="p-5"><Skeleton className="h-5 w-28" /><Skeleton className="mt-5 h-40 w-full" /></Card></div></div>;

  return (
    <div>
      <PageTitle
        title={client.name}
        subtitle={client.industry || undefined}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className={btnSecondary}
              onClick={updateRadar}
              disabled={radarBusy || !client.industry}
              title={
                !client.industry
                  ? "Definí la industria del cliente para leer noticias del rubro"
                  : "Lee noticias recientes del rubro y genera ángulos de oportunidad"
              }
            >
              {radarBusy ? "Leyendo noticias…" : <><Radar size={16} strokeWidth={1.75} /> Actualizar radar</>}
            </button>
            <button className={btnSecondary} onClick={() => setEditing(!editing)}>
              {editing ? "Cancelar" : "Editar"}
            </button>
            <Link href={`/generar?clientId=${id}`} className={btnPrimary}>
              <Sparkles size={16} strokeWidth={1.75} /> Generar guion
            </Link>
          </div>
        }
      />

      {radarErr && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-800 mb-4">
          {radarErr}
        </div>
      )}
      {radar && (
        <Card className="px-5 py-3 mb-4 flex items-center gap-3 text-sm">
          {(() => {
            const days = Math.floor(
              (Date.now() - new Date(radar.createdAt).getTime()) / (24 * 60 * 60 * 1000)
            );
            return (
              <>
                <Badge tone={days < 7 ? "green" : "yellow"}>
                  <Radar className="inline" size={13} strokeWidth={1.75} /> Radar {days === 0 ? "de hoy" : `de hace ${days} día${days === 1 ? "" : "s"}`}
                </Badge>
                <span className="text-slate-600 flex-1">{radar.title}</span>
                <span className="text-xs text-slate-400">
                  Entra como documento sugerido en las próximas generaciones
                </span>
              </>
            );
          })()}
        </Card>
      )}

      {editing ? (
        <Card className="p-5 mb-6">
          <form onSubmit={handleSave} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre
              </label>
              <input name="name" defaultValue={client.name} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Industria
              </label>
              <input
                name="industry"
                defaultValue={client.industry ?? ""}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Descripción
              </label>
              <textarea
                name="description"
                rows={2}
                defaultValue={client.description ?? ""}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Notas de la agencia (van al contexto de generación)
              </label>
              <textarea
                name="notes"
                rows={3}
                defaultValue={client.notes ?? ""}
                className={inputCls}
              />
            </div>
            <div className="md:col-span-2">
              <button className={btnPrimary}>Guardar cambios</button>
            </div>
          </form>
        </Card>
      ) : (
        client.description && (
          <Card className="p-5 mb-6 text-sm text-slate-600">
            {client.description}
          </Card>
        )
      )}

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <DocumentManager scope={id} />

        <div className="space-y-4">
          <h2 className="font-semibold text-brand-navy">
            Guiones ({scripts.length})
          </h2>
          <Card>
            {scripts.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                Todavía no hay guiones para este cliente.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {scripts.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/guiones/${s.id}`}
                      className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-brand-mist"
                    >
                      <span className="flex-1 font-medium">{s.title}</span>
                      {s.outcome === "won" && <Badge tone="green">Ganador</Badge>}
                      {s.outcome === "lost" && (
                        <Badge tone="red">No convirtió</Badge>
                      )}
                      <span className="text-xs text-slate-400">
                        {s.createdAt.slice(0, 10)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
