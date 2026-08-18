"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, KIND_LABELS, btnSecondary, inputCls } from "./ui";
import DocumentList from "./DocumentList";

/**
 * Lista + subida de documentos.
 * `scope`: "agencia" | "industria:<slug>" | "global" | un clientId numérico.
 *
 * La lista vive en `DocumentList` para poder reusarla en la biblioteca por
 * rubro, donde no hace falta el formulario de subida.
 */
export default function DocumentManager({
  scope,
  industria,
}: {
  scope: string;
  /** Si viene, el documento se sube a la biblioteca de ese rubro. */
  industria?: string;
}) {
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    setError(null);
    setWarning(null);
    const fd = new FormData(e.currentTarget);
    // El endpoint espera el clientId; para los scopes que no son de cliente
    // manda "global" y deja que `industry` decida dónde aterriza.
    const esCliente = /^\d+$/.test(scope);
    fd.set("clientId", esCliente ? scope : "global");
    if (industria) fd.set("industry", industria);

    const res = await fetch("/api/documents", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (!res.ok) {
      const message = data.error || "Error al subir el documento";
      setError(message);
      toast.error(message);
      return;
    }
    if (data.warning) {
      setWarning(data.warning);
      toast.warning(data.warning);
    } else {
      toast.success("Documento guardado");
    }
    formRef.current?.reset();
    setShowForm(false);
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-brand-navy">Documentos</h2>
        <button className={btnSecondary} onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "+ Agregar documento"}
        </button>
      </div>

      {warning && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mr-1 inline" size={16} strokeWidth={1.75} /> {warning}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      {showForm && (
        <Card className="p-5">
          <form ref={formRef} onSubmit={handleUpload} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Título</label>
                <input name="title" className={inputCls} placeholder="Ej: Brief inicial del producto" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Tipo de documento</label>
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
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Archivo (PDF, DOCX, TXT, MD)
              </label>
              <input type="file" name="file" accept=".pdf,.docx,.txt,.md" className="text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                … o pegá el texto directamente
              </label>
              <textarea
                name="text"
                rows={5}
                className={inputCls}
                placeholder="Pegá aquí el contenido del documento (transcript, brief, guion...)"
              />
            </div>
            <Button type="submit" loading={uploading} loadingLabel="Procesando…">
              Guardar documento
            </Button>
          </form>
        </Card>
      )}

      <DocumentList
        scope={scope}
        refreshKey={refreshKey}
        onEmptyAction={
          <button className={btnSecondary} onClick={() => setShowForm(true)}>
            Agregar documento
          </button>
        }
      />
    </div>
  );
}
