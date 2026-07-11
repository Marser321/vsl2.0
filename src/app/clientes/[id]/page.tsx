"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import DocumentManager from "@/components/DocumentManager";
import { Badge, Card, PageTitle, btnPrimary, btnSecondary, inputCls } from "@/components/ui";

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

export default function ClientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [client, setClient] = useState<Client | null>(null);
  const [scripts, setScripts] = useState<ScriptRow[]>([]);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([
      fetch(`/api/clients/${id}`).then((r) => r.json()),
      fetch(`/api/scripts?clientId=${id}`).then((r) => r.json()),
    ]);
    setClient(c);
    setScripts(s);
  }, [id]);

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

  if (!client) return <div className="text-sm text-slate-400">Cargando…</div>;

  return (
    <div>
      <PageTitle
        title={client.name}
        subtitle={client.industry || undefined}
        actions={
          <div className="flex gap-2">
            <button className={btnSecondary} onClick={() => setEditing(!editing)}>
              {editing ? "Cancelar" : "Editar"}
            </button>
            <Link href={`/generar?clientId=${id}`} className={btnPrimary}>
              ✦ Generar guion
            </Link>
          </div>
        }
      />

      {editing ? (
        <Card className="p-5 mb-6">
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
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
            <div className="col-span-2">
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
            <div className="col-span-2">
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
            <div className="col-span-2">
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

      <div className="grid grid-cols-2 gap-8">
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
