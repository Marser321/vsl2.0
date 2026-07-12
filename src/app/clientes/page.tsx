"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, EmptyState, PageTitle, Skeleton, btnPrimary, inputCls } from "@/components/ui";
import { Users } from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      setList(await (await fetch("/api/clients")).json());
    } finally {
      setLoading(false);
    }
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
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Descripción breve
              </label>
              <textarea name="description" rows={2} className={inputCls} />
            </div>
            <div className="sm:col-span-2">
              <button className={btnPrimary} disabled={saving}>
                {saving ? "Guardando…" : "Crear cliente"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => <Card className="p-5" key={index}><Skeleton className="h-5 w-36" /><Skeleton className="mt-3 h-3 w-24" /><Skeleton className="mt-4 h-3 w-full" /></Card>)}
        </div>
      ) : list.length === 0 && !showForm ? (
        <Card><EmptyState icon={Users} title="Todavía no hay clientes" description="Creá el primero para empezar a generar guiones." action={<button className={btnPrimary} onClick={() => setShowForm(true)}>Crear cliente</button>} /></Card>
      ) : <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
      </div>}
    </div>
  );
}
