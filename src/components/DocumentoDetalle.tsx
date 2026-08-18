"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  Badge,
  Button,
  Card,
  CopyButton,
  EmptyState,
  KIND_LABELS,
  KIND_TONES,
  FORMAT_LABELS,
  PageTitle,
  Skeleton,
  btnSecondary,
  inputCls,
} from "./ui";
import ScriptMarkdown from "./ScriptMarkdown";
import { separarGuion } from "@/lib/guion";
import { analyzeScript, fmtTime } from "@/lib/readtime";

type Documento = {
  id: number;
  clientId: number | null;
  visibility: "private" | "global" | "industry";
  industry: string | null;
  industrySlug: string | null;
  format: "vsl" | "reel" | null;
  title: string;
  kind: string;
  extractedText: string;
  tokenCount: number;
  tags: string[];
  isActive: boolean;
};

type Cliente = { id: number; name: string };

export default function DocumentoDetalle({ id }: { id: number }) {
  const router = useRouter();
  const [doc, setDoc] = useState<Documento | null>(null);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [usando, setUsando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [clienteId, setClienteId] = useState("");

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/documents/${id}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data: Documento = await res.json();
    setDoc(data);
    setTitulo(data.title);
    setTexto(data.extractedText);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    cargar();
    fetch("/api/clients")
      .then((r) => (r.ok ? r.json() : []))
      .then(setClientes)
      .catch(() => setClientes([]));
  }, [cargar]);

  // Los bloques sirven para copiar el gancho, una objeción o el CTA por
  // separado, que es lo que hace falta al armar un guion con piezas de varios.
  const bloques = useMemo(() => (doc ? separarGuion(doc.extractedText) : []), [doc]);
  /** Un guion con beats identificables se lee mucho mejor estructurado. */
  const estructurado = useMemo(
    () => bloques.length > 1 && bloques.some((b) => b.rango !== null),
    [bloques]
  );
  const stats = useMemo(
    () => (doc?.extractedText ? analyzeScript(doc.extractedText) : null),
    [doc]
  );

  async function guardar() {
    setGuardando(true);
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: titulo, extractedText: texto }),
    });
    setGuardando(false);
    if (!res.ok) {
      toast.error("No se pudo guardar el documento");
      return;
    }
    toast.success("Documento guardado");
    setEditando(false);
    await cargar();
  }

  async function usarComoBase() {
    if (!clienteId) {
      toast.error("Elegí para qué cliente");
      return;
    }
    setUsando(true);
    const res = await fetch(`/api/documents/${id}/use`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: Number(clienteId) }),
    });
    const data = await res.json();
    setUsando(false);
    if (!res.ok) {
      toast.error(data.error ?? "No se pudo crear el guion");
      return;
    }
    toast.success("Guion creado a partir del documento");
    router.push(`/guiones/${data.scriptId}?edit=1`);
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!doc) {
    return (
      <Card>
        <EmptyState
          icon={FileText}
          title="Documento no encontrado"
          description="Puede que se haya eliminado."
          action={
            <Link href="/biblioteca" className={btnSecondary}>
              Volver a la biblioteca
            </Link>
          }
        />
      </Card>
    );
  }

  const volverA =
    doc.visibility === "industry" && doc.industrySlug
      ? `/biblioteca/${doc.industrySlug}`
      : doc.clientId
        ? `/clientes/${doc.clientId}`
        : "/biblioteca/agencia";

  return (
    <div>
      <Link
        href={volverA}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-blue"
      >
        <ArrowLeft size={15} strokeWidth={1.75} /> Volver
      </Link>

      <PageTitle
        title={doc.title}
        subtitle={[
          KIND_LABELS[doc.kind] ?? doc.kind,
          doc.industry,
          stats ? `${stats.totalWords} palabras · ~${fmtTime(stats.totalSec)}` : null,
          `${doc.tokenCount.toLocaleString("es")} tokens`,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            <CopyButton text={doc.extractedText} label="Copiar todo" copiedLabel="Copiado" />
            <button className={btnSecondary} onClick={() => setEditando((v) => !v)}>
              {editando ? "Cancelar edición" : "Editar"}
            </button>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge tone={KIND_TONES[doc.kind] ?? "gray"}>{KIND_LABELS[doc.kind] ?? doc.kind}</Badge>
        {doc.format && <Badge tone="gray">{FORMAT_LABELS[doc.format] ?? doc.format}</Badge>}
        {!doc.isActive && <Badge tone="yellow">Excluido del contexto</Badge>}
        {doc.tags.map((t) => (
          <span key={t} className="text-xs text-slate-400">
            #{t}
          </span>
        ))}
      </div>

      {editando ? (
        <Card className="p-5">
          <label className="mb-1 block text-xs font-semibold text-slate-600">Título</label>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} />
          <label className="mb-1 mt-4 block text-xs font-semibold text-slate-600">
            Contenido
          </label>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={24}
            className={`${inputCls} font-mono text-[13px] leading-6`}
          />
          <div className="mt-4 flex gap-2">
            <Button onClick={guardar} loading={guardando} loadingLabel="Guardando…">
              Guardar cambios
            </Button>
            <button
              className={btnSecondary}
              onClick={() => {
                setTitulo(doc.title);
                setTexto(doc.extractedText);
                setEditando(false);
              }}
            >
              Descartar
            </button>
          </div>
        </Card>
      ) : (
        <>
          <Card className="mb-6 p-6">
            {estructurado ? (
              // Los guiones extraídos de PDF son texto plano tabulado: pasarlos
              // por el renderer de markdown los colapsa en un párrafo corrido e
              // ilegible. Con la estructura ya detectada, se muestran por beat.
              <div className="space-y-6">
                {bloques.map((b, i) => (
                  <div key={i}>
                    <div className="mb-1.5 flex flex-wrap items-baseline gap-2">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-brand-navy">
                        {b.titulo}
                      </h3>
                      {b.rango && <span className="text-xs text-slate-400">{b.rango}</span>}
                    </div>
                    {b.locucion.map((p, j) => (
                      <p key={j} className="mb-2 text-[15px] leading-7 text-slate-800">
                        {p}
                      </p>
                    ))}
                    {b.acotaciones.length > 0 && (
                      <ul className="mt-1.5 space-y-0.5">
                        {b.acotaciones.map((a, j) => (
                          <li key={j} className="text-xs italic text-slate-400">
                            {a}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <ScriptMarkdown content={doc.extractedText} />
            )}
          </Card>

          {bloques.length > 1 && (
            <Card className="mb-6 p-5">
              <h2 className="font-semibold text-brand-navy">Copiar por bloque</h2>
              <p className="mt-1 text-xs text-slate-500">
                Para reutilizar una pieza suelta — el gancho, una objeción, el cierre — sin llevarte
                el guion entero.
              </p>
              <ul className="mt-3 divide-y divide-slate-100">
                {bloques.map((b, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-3 py-2.5 text-sm">
                    <span className="min-w-40 flex-1 font-medium text-brand-navy">
                      {b.titulo}
                      {b.rango && <span className="ml-2 text-xs text-slate-400">{b.rango}</span>}
                    </span>
                    <span className="text-xs text-slate-400">
                      {b.locucion.join(" ").split(/\s+/).filter(Boolean).length} palabras
                    </span>
                    <CopyButton
                      text={b.locucion.join("\n\n")}
                      label="Copiar"
                      copiedLabel="Copiado"
                    />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="flex items-center gap-2 font-semibold text-brand-navy">
              <Sparkles size={17} strokeWidth={1.75} /> Usar como base
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Crea un guion editable con este texto para adaptarlo a otro cliente. Podés refinarlo,
              criticarlo y sacarle hooks como cualquier guion generado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <select
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                className={`${inputCls} w-auto min-w-56`}
                aria-label="Cliente para el guion nuevo"
              >
                <option value="">Elegí un cliente…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Button onClick={usarComoBase} loading={usando} loadingLabel="Creando…">
                Crear guion
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
