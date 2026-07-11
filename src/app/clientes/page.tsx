"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, PageTitle, btnPrimary, inputCls } from "@/components/ui";

type Client = {
  id: number;
  name: string;
  industry: string | null;
  description: string | null;
  createdAt: string;
};

export default function ClientesPage() {
  const [list, setList] = useState<Client[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setList(await (await fetch("/api/clients")).json());
  }
  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        industry: fd.get("industry"),
        description: fd.get("description"),
      }),
    });
    setSaving(false);
    setShowForm(false);
    load();
  }

  return (
    <div>
      <PageTitle
        title="Clientes"
        subtitle="Cada cliente tiene su dossier de documentos y sus guiones"
        actions={
          <button className={btnPrimary} onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancelar" : "+ Nuevo cliente"}
          </button>
        }
      />

      {showForm && (
        <Card className="p-5 mb-6">
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Nombre *
              </label>
              <input name="name" required className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Industria / nicho
              </label>
              <input
                name="industry"
                className={inputCls}
                placeholder="Ej: fitness, e-commerce, infoproductos"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Descripción breve
              </label>
              <textarea name="description" rows={2} className={inputCls} />
            </div>
            <div className="col-span-2">
              <button className={btnPrimary} disabled={saving}>
                {saving ? "Guardando…" : "Crear cliente"}
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        {list.map((c) => (
          <Link key={c.id} href={`/clientes/${c.id}`}>
            <Card className="p-5 hover:border-brand-blue transition-colors h-full">
              <div className="font-semibold text-brand-navy">{c.name}</div>
              {c.industry && (
                <div className="text-xs text-brand-blue mt-1">{c.industry}</div>
              )}
              {c.description && (
                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                  {c.description}
                </p>
              )}
            </Card>
          </Link>
        ))}
        {list.length === 0 && !showForm && (
          <Card className="p-8 col-span-3 text-center text-sm text-slate-400">
            Todavía no hay clientes. Creá el primero para empezar a generar
            guiones.
          </Card>
        )}
      </div>
    </div>
  );
}
