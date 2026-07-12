"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Badge,
  Card,
  EmptyState,
  KIND_LABELS,
  KIND_TONES,
  btnPrimary,
  btnSecondary,
  inputCls,
  Skeleton,
} from "./ui";
import { AlertTriangle, Library } from "lucide-react";

type Doc = {
  id: number;
  title: string;
  kind: string;
  filename: string | null;
  tokenCount: number;
  isActive: boolean;
  createdAt: string;
};

/** Lista + subida de documentos. scope: "global" o un clientId numérico. */
export default function DocumentManager({ scope }: { scope: string }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<HTMLFormElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/documents?clientId=${scope}`);
      setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setWarning(null);
    const fd = new FormData(e.currentTarget);
    fd.set("clientId", scope);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      setError(data.error || "Error al subir el documento");
      return;
    }
    if (data.warning) setWarning(data.warning);
    formRef.current?.reset();
    setShowForm(false);
    load();
  }

  async function toggleActive(doc: Doc) {
    await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !doc.isActive }),
    });
    load();
  }

  async function remove(doc: Doc) {
    if (!confirm(`¿Eliminar "${doc.title}"? Esta acción no se puede deshacer.`))
      return;
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-brand-navy">
          Documentos ({docs.length})
        </h2>
        <button className={btnSecondary} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "+ Agregar documento"}
        </button>
      </div>

      {warning && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mr-1 inline" size={16} strokeWidth={1.75} /> {warning}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="p-5">
          <form ref={formRef} onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Título
                </label>
                <input
                  name="title"
                  className={inputCls}
                  placeholder="Ej: Brief inicial del producto"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tipo de documento
                </label>
                <select name="kind" className={inputCls} required>
                  {Object.entries(KIND_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Archivo (PDF, DOCX, TXT, MD)
              </label>
              <input
                type="file"
                name="file"
                accept=".pdf,.docx,.txt,.md"
                className="text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                … o pegá el texto directamente
              </label>
              <textarea
                name="text"
                rows={5}
                className={inputCls}
                placeholder="Pegá aquí el contenido del documento (transcript, brief, guion...)"
              />
            </div>
            <button className={btnPrimary} disabled={uploading}>
              {uploading ? "Procesando…" : "Guardar documento"}
            </button>
          </form>
        </Card>
      )}

      <Card>
        {loading ? (
          <div className="divide-y divide-slate-100">{Array.from({ length: 4 }).map((_, index) => <div className="flex gap-4 px-5 py-4" key={index}><Skeleton className="h-5 w-24 rounded-full" /><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-20" /></div>)}</div>
        ) : docs.length === 0 ? (
          <EmptyState icon={Library} title="Todavía no hay documentos" description="Subí briefs, guiones ganadores y material de referencia para mejorar la calidad de los copys." action={<button className={btnSecondary} onClick={() => setShowForm(true)}>Agregar documento</button>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {docs.map((doc) => (
              <li
                key={doc.id}
                className="flex items-center gap-3 px-5 py-3 text-sm"
              >
                <Badge tone={KIND_TONES[doc.kind] ?? "gray"}>
                  {KIND_LABELS[doc.kind] ?? doc.kind}
                </Badge>
                <span
                  className={`flex-1 font-medium ${doc.isActive ? "" : "line-through text-slate-400"}`}
                >
                  {doc.title}
                </span>
                <span className="text-xs text-slate-400">
                  {doc.tokenCount.toLocaleString("es")} tokens
                </span>
                <button
                  onClick={() => toggleActive(doc)}
                  className="text-xs text-slate-500 hover:text-brand-blue"
                  title={
                    doc.isActive
                      ? "Excluir del contexto de generación"
                      : "Incluir en el contexto de generación"
                  }
                >
                  {doc.isActive ? "Activo" : "Inactivo"}
                </button>
                <button
                  onClick={() => remove(doc)}
                  className="text-xs text-slate-400 hover:text-rose-600"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
