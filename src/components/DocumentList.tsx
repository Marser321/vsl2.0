"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Library, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Card,
  ConfirmDialog,
  EmptyState,
  KIND_LABELS,
  KIND_TONES,
  FORMAT_LABELS,
  Skeleton,
  btnSecondary,
  inputCls,
} from "./ui";

export type DocumentoListado = {
  id: number;
  clientId: number | null;
  visibility: "private" | "global" | "industry";
  industry: string | null;
  industrySlug: string | null;
  format: "vsl" | "reel" | null;
  title: string;
  kind: string;
  filename: string | null;
  tokenCount: number;
  tags: string[];
  isActive: boolean;
  createdAt: string;
};

const FILTRO_TODOS = "todos";

/**
 * Lista de documentos con buscador y filtros. Separada de `DocumentManager`
 * (que le agrega el formulario de subida) para poder reusarla en la biblioteca
 * por rubro, donde no se sube nada.
 *
 * El título es un link al detalle: leer un documento era justamente lo que no
 * se podía hacer.
 */
export default function DocumentList({
  scope,
  onEmptyAction,
  emptyDescription,
  refreshKey = 0,
}: {
  /** "agencia" | "industria:<slug>" | "<clientId>" | "global" */
  scope: string;
  onEmptyAction?: React.ReactNode;
  emptyDescription?: string;
  /** Cambiar este número fuerza una recarga (lo usa el formulario de subida). */
  refreshKey?: number;
}) {
  const [docs, setDocs] = useState<DocumentoListado[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [kind, setKind] = useState(FILTRO_TODOS);
  const [formato, setFormato] = useState(FILTRO_TODOS);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [aEliminar, setAEliminar] = useState<DocumentoListado | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents?scope=${encodeURIComponent(scope)}`);
    try {
      if (res.ok) setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // El filtrado es en cliente a propósito: el listado ya no trae el texto de los
  // documentos, así que unos cientos de filas de metadata pesan poco y filtrar
  // sin ida y vuelta al servidor se siente instantáneo mientras escribís.
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return docs.filter((doc) => {
      if (q && !doc.title.toLowerCase().includes(q)) return false;
      if (kind !== FILTRO_TODOS && doc.kind !== kind) return false;
      if (formato === "agnostico" && doc.format !== null) return false;
      if (formato !== FILTRO_TODOS && formato !== "agnostico" && doc.format !== formato) return false;
      return true;
    });
  }, [docs, busqueda, kind, formato]);

  const kindsPresentes = useMemo(
    () => [...new Set(docs.map((d) => d.kind))].sort(),
    [docs]
  );

  async function toggleActive(doc: DocumentoListado) {
    setTogglingId(doc.id);
    const res = await fetch(`/api/documents/${doc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !doc.isActive }),
    });
    setTogglingId(null);
    if (!res.ok) {
      toast.error("No se pudo cambiar el estado del documento");
      return;
    }
    toast.success(doc.isActive ? "Documento excluido del contexto" : "Documento incluido en el contexto");
    await load();
  }

  async function eliminar() {
    if (!aEliminar) return;
    const res = await fetch(`/api/documents/${aEliminar.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("No se pudo eliminar el documento");
      return;
    }
    setAEliminar(null);
    toast.success("Documento eliminado");
    load();
  }

  if (loading) {
    return (
      <Card>
        <div className="divide-y divide-slate-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="flex gap-4 px-5 py-4" key={i}>
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {docs.length > 8 && (
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={`${inputCls} pl-9`}
              placeholder={`Buscar entre ${docs.length} documentos…`}
              aria-label="Buscar documentos por título"
            />
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            className={`${inputCls} w-auto`}
            aria-label="Filtrar por tipo"
          >
            <option value={FILTRO_TODOS}>Todos los tipos</option>
            {kindsPresentes.map((k) => (
              <option key={k} value={k}>
                {KIND_LABELS[k] ?? k}
              </option>
            ))}
          </select>
          <select
            value={formato}
            onChange={(e) => setFormato(e.target.value)}
            className={`${inputCls} w-auto`}
            aria-label="Filtrar por formato"
          >
            <option value={FILTRO_TODOS}>Todos los formatos</option>
            <option value="vsl">VSL</option>
            <option value="reel">Reel</option>
            <option value="agnostico">Sin formato</option>
          </select>
        </div>
      )}

      <Card>
        {docs.length === 0 ? (
          <EmptyState
            icon={Library}
            title="Todavía no hay documentos"
            description={
              emptyDescription ??
              "Subí briefs, guiones ganadores y material de referencia para mejorar la calidad de los copys."
            }
            action={onEmptyAction}
          />
        ) : visibles.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Ningún documento coincide"
            description="Probá con otras palabras o quitá los filtros."
            action={
              <button
                className={btnSecondary}
                onClick={() => {
                  setBusqueda("");
                  setKind(FILTRO_TODOS);
                  setFormato(FILTRO_TODOS);
                }}
              >
                Limpiar filtros
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {visibles.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5">
                <Badge tone={KIND_TONES[doc.kind] ?? "gray"}>{KIND_LABELS[doc.kind] ?? doc.kind}</Badge>
                {doc.format && <Badge tone="gray">{FORMAT_LABELS[doc.format] ?? doc.format}</Badge>}
                <Link
                  href={`/documentos/${doc.id}`}
                  className={`min-w-48 flex-1 font-medium hover:text-brand-blue hover:underline ${
                    doc.isActive ? "" : "text-slate-400 line-through"
                  }`}
                >
                  {doc.title}
                </Link>
                <span className="text-xs text-slate-400">
                  {doc.tokenCount.toLocaleString("es")} tokens
                </span>
                <button
                  onClick={() => toggleActive(doc)}
                  disabled={togglingId === doc.id}
                  className="text-xs text-slate-500 hover:text-brand-blue"
                  title={
                    doc.isActive
                      ? "Excluir del contexto de generación"
                      : "Incluir en el contexto de generación"
                  }
                >
                  {togglingId === doc.id ? "Actualizando…" : doc.isActive ? "Activo" : "Inactivo"}
                </button>
                <button
                  onClick={() => setAEliminar(doc)}
                  className="text-xs text-slate-400 hover:text-rose-600"
                >
                  Eliminar
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {visibles.length > 0 && visibles.length !== docs.length && (
        <p className="text-xs text-slate-500">
          {visibles.length} de {docs.length} documentos
        </p>
      )}

      <ConfirmDialog
        open={aEliminar !== null}
        onClose={() => setAEliminar(null)}
        onConfirm={eliminar}
        title="Eliminar documento"
        message={
          <>
            ¿Eliminar <strong>“{aEliminar?.title}”</strong>? Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Eliminar"
        destructive
      />
    </div>
  );
}
