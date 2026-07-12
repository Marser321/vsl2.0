"use client";

import Link from "next/link";
import { Suspense, use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ScriptMarkdown from "@/components/ScriptMarkdown";
import ScriptEditor from "@/components/ScriptEditor";
import RatingWidget, { type VersionRating } from "@/components/RatingWidget";
import { MetricsPanel } from "@/components/MetricsPanel";
import HookLab from "@/components/HookLab";
import CritiquePanel from "@/components/CritiquePanel";
import LearningsPanel from "@/components/LearningsPanel";
import {
  Badge,
  Card,
  ConfirmDialog,
  Input,
  PageTitle,
  Skeleton,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "@/components/ui";
import { slugify } from "@/lib/templates";
import { ArrowLeft, ArrowRight, Check, Download, LayoutTemplate, Pencil, Play, Star } from "lucide-react";
import { toast } from "sonner";

type Usage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
} | null;

type Version = {
  id: number;
  versionNumber: number;
  content: string;
  refinementInstruction: string | null;
  source: "ai" | "manual" | "template";
  usage: Usage;
  createdAt: string;
  rating: VersionRating;
};

type ScriptDetail = {
  id: number;
  title: string;
  status: string;
  outcome: string;
  format?: string;
  provider: string;
  model: string;
  brief?: Record<string, unknown>;
  client: { id: number; name: string } | null;
  framework: { id: number; name: string } | null;
  versions: Version[];
  promotions: Array<{
    documentId: number;
    versionId: number | null;
    scope: "client" | "global";
    legacy: boolean;
  }>;
};

function versionTooltip(v: Version): string {
  if (v.source === "manual") return "Edición manual";
  if (v.source === "template") return "Creado desde plantilla";
  return v.refinementInstruction ?? "Versión original";
}

function GuionDetail({ id }: { id: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [script, setScript] = useState<ScriptDetail | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [pinnedSuggestions, setPinnedSuggestions] = useState<string[]>([]);
  const [wpm, setWpm] = useState(150);
  const [refining, setRefining] = useState(false);
  const [refineOutput, setRefineOutput] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const refineRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const openedFromQuery = useRef(false);
  const refineFromQueryApplied = useRef(false);

  const load = useCallback(async () => {
    const data = await (await fetch(`/api/scripts/${id}`)).json();
    setScript(data);
    if (data.versions?.length) {
      setActiveVersion(data.versions[data.versions.length - 1].versionNumber);
    }
    return data as ScriptDetail;
  }, [id]);

  useEffect(() => {
    load().then(() => {
      // ?edit=1: aterrizar directo en el editor (flujo "usar plantilla")
      if (!openedFromQuery.current && searchParams.get("edit") === "1") {
        openedFromQuery.current = true;
        setEditing(true);
      }
    });
  }, [load, searchParams]);

  useEffect(() => {
    if (refineFromQueryApplied.current || !script || !refineRef.current) return;
    const rawInstruction = searchParams.get("refine");
    if (!rawInstruction) return;
    refineFromQueryApplied.current = true;
    let instruction = rawInstruction;
    try {
      instruction = decodeURIComponent(rawInstruction);
    } catch {
      // useSearchParams ya puede entregar el valor decodificado.
    }
    refineRef.current.value = instruction;
    refineRef.current.scrollIntoView({ block: "center" });
    refineRef.current.focus();
    router.replace(`/guiones/${id}`, { scroll: false });
  }, [id, router, script, searchParams]);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setWpm(Number(s.wpm_es) || 150))
      .catch(() => {});
  }, []);

  const current = script?.versions.find(
    (v) => v.versionNumber === activeVersion
  );

  async function handleRefine() {
    const instruction = refineRef.current?.value.trim();
    if (!instruction || !script || !current) return;
    setRefining(true);
    setRefineOutput("");
    setError(null);
    setAiStatus("Preparando arnés 5+1");

    try {
      const res = await fetch(`/api/scripts/${script.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction, versionId: current.id }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al refinar");
      }
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const evt of events) {
          if (!evt.startsWith("data: ")) continue;
          const data = JSON.parse(evt.slice(6));
          if (data.type === "status") {
            setAiStatus(`${data.stage} (${data.completed}/${data.total})`);
          } else if (data.type === "delta") {
            setRefineOutput((prev) => prev + data.text);
            outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        }
      }
      if (refineRef.current) refineRef.current.value = "";
      setRefining(false);
      setRefineOutput("");
      await load();
    } catch (err) {
      setRefining(false);
      setError((err as Error).message);
    }
  }

  async function markOutcome(outcome: "won" | "lost" | "unknown") {
    await fetch(`/api/scripts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ outcome }),
    });
    load();
  }

  async function promote(scope: "client" | "global", versionId: number) {
    const selectedVersion = activeVersion;
    const res = await fetch(`/api/scripts/${id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope, versionId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "No se pudo promover el guion");
      return false;
    }
    await load();
    if (selectedVersion !== null) setActiveVersion(selectedVersion);
    return true;
  }

  async function saveAsTemplate() {
    if (!current || !script) return;
    const title = templateTitle.trim();
    if (!title) {
      toast.error("Ingresá un nombre para la plantilla");
      return;
    }
    const res = await fetch("/api/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slugify(title),
        title,
        format: script.format === "reel" ? "reel" : "vsl",
        frameworkId: script.framework?.id ?? null,
        description: `Guardada desde "${script.title}"`,
        briefDefaults: script.brief ?? {},
        contentMd: current.content,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      toast.success(`Plantilla "${title}" creada`);
      setTemplateDialogOpen(false);
    } else {
      toast.error(data.error || "Error al crear la plantilla");
    }
  }

  function exportMd() {
    if (!current || !script) return;
    const blob = new Blob([current.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.title.replace(/[^\w\sáéíóúñ-]/gi, "")}-v${current.versionNumber}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!script) return <div aria-label="Cargando guion"><Skeleton className="h-8 w-72" /><Skeleton className="mt-2 h-4 w-40" /><Card className="mt-6 p-6"><Skeleton className="h-5 w-48" /><Skeleton className="mt-5 h-96 w-full" /></Card></div>;

  const cachePct =
    current?.usage &&
    current.usage.inputTokens +
      current.usage.cacheReadTokens +
      current.usage.cacheCreationTokens >
      0
      ? Math.round(
          (current.usage.cacheReadTokens /
            (current.usage.inputTokens +
              current.usage.cacheReadTokens +
              current.usage.cacheCreationTokens)) *
            100
        )
      : null;

  return (
    <div className="max-w-5xl">
      <PageTitle
        title={script.title}
        subtitle={`${script.client?.name ?? "—"}${script.framework ? ` · ${script.framework.name}` : ""} · ${script.model}${script.format === "reel" ? " · Reel vertical" : ""}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {!editing && (
              <button className={btnSecondary} onClick={() => setEditing(true)}>
                <Pencil size={16} strokeWidth={1.75} /> Editar guion
              </button>
            )}
            <Link
              href={`/guiones/${id}/teleprompter`}
              className={btnSecondary}
            >
              <Play size={16} strokeWidth={1.75} /> Teleprompter
            </Link>
            <button className={btnSecondary} onClick={exportMd}>
              <Download size={16} strokeWidth={1.75} /> Exportar .md
            </button>
            <button
              className={btnSecondary}
              onClick={() => {
                setTemplateTitle(script.title);
                setTemplateDialogOpen(true);
              }}
              title="Guardar la versión activa como plantilla reutilizable"
            >
              <LayoutTemplate size={16} strokeWidth={1.75} /> Plantilla
            </button>
            {script.outcome !== "won" ? (
              <button className={btnPrimary} onClick={() => markOutcome("won")}>
                <Star size={16} strokeWidth={1.75} /> Marcar ganador
              </button>
            ) : (
              <Badge tone="green"><Star className="inline" size={13} strokeWidth={1.75} /> Guion ganador</Badge>
            )}
          </div>
        }
      />

      {script.outcome === "won" && script.promotions.length === 0 && current && (
        <Card className="p-4 mb-4 flex items-center justify-between bg-emerald-50 border-emerald-200">
          <span className="text-sm text-emerald-800">
            Este guion convirtió. Promové la v{current.versionNumber} visible para que sirva de ejemplo en futuras generaciones.
          </span>
          <div className="flex gap-2">
            <button className={btnSecondary} onClick={() => promote("client", current.id)}>
              Solo para {script.client?.name}
            </button>
            <button className={btnPrimary} onClick={() => promote("global", current.id)}>
              Biblioteca global
            </button>
          </div>
        </Card>
      )}
      {script.promotions.length > 0 && (
        <Card className="p-4 mb-4 text-sm text-emerald-800 bg-emerald-50 border-emerald-200">
          <Check className="mr-1 inline" size={15} strokeWidth={1.75} />
          {script.promotions.map((promotion) =>
            promotion.legacy
              ? ` Ejemplar anterior · ${promotion.scope === "global" ? "global" : "cliente"}`
              : ` v${script.versions.find((version) => version.id === promotion.versionId)?.versionNumber ?? "?"} · ${promotion.scope === "global" ? "global" : "cliente"}`
          ).join(" ·")}
        </Card>
      )}

      <div className="flex gap-2 mb-4 items-center">
        <span className="text-xs text-slate-500">Versiones:</span>
        {script.versions.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveVersion(v.versionNumber)}
            disabled={editing && v.versionNumber !== activeVersion}
            title={
              editing && v.versionNumber !== activeVersion
                ? "Cerrá el editor para cambiar de versión"
                : versionTooltip(v)
            }
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
              v.versionNumber === activeVersion
                ? "bg-brand-blue text-white border-brand-blue"
                : "bg-white text-slate-600 border-slate-300 hover:border-brand-blue"
            }`}
          >
            v{v.versionNumber}
            {v.source === "manual" && <Pencil className="ml-1 inline" size={12} strokeWidth={1.75} />}
          </button>
        ))}
        {cachePct !== null && (
          <span className="ml-auto text-[11px] text-slate-400">
            caché de prompt: {cachePct}% · {current?.usage?.outputTokens.toLocaleString("es")} tokens de salida
          </span>
        )}
      </div>

      {current?.refinementInstruction && (
        <div className="text-xs text-slate-500 mb-3">
          Instrucción de esta versión: “{current.refinementInstruction}”
        </div>
      )}

      {current && !editing && (
        <>
          <RatingWidget
            scriptId={script.id}
            versionId={current.id}
            rating={current.rating}
            onRated={async () => {
              const prev = activeVersion;
              await load();
              if (prev !== null) setActiveVersion(prev);
            }}
          />
          <MetricsPanel
            scriptId={script.id}
            activeVersion={{ id: current.id, versionNumber: current.versionNumber }}
            promotions={script.promotions}
            onPromote={(versionId) => promote("client", versionId)}
          />
        </>
      )}

      {editing && current ? (
        <ScriptEditor
          scriptId={script.id}
          version={{
            id: current.id,
            versionNumber: current.versionNumber,
            content: current.content,
          }}
          latestVersionNumber={
            script.versions[script.versions.length - 1].versionNumber
          }
          wpm={wpm}
          pinnedSuggestions={pinnedSuggestions}
          onDismissSuggestion={(i) =>
            setPinnedSuggestions((prev) => prev.filter((_, j) => j !== i))
          }
          onSaved={async (v) => {
            await load();
            setActiveVersion(v.versionNumber);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <Card className="p-6 mb-6">
          {refining ? (
            <div>
              <div className="text-xs text-brand-blue animate-pulse mb-3">
                {aiStatus || "Los modelos están trabajando"}
              </div>
              <div ref={outputRef} className="max-h-[55vh] overflow-y-auto">
                <ScriptMarkdown content={refineOutput || "…"} />
              </div>
            </div>
          ) : (
            <ScriptMarkdown content={current?.content ?? ""} />
          )}
        </Card>
      )}

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4">
          {error}
        </div>
      )}

      <Card className="p-5">
        <h3 className="font-semibold text-brand-navy text-sm mb-2">
          Refinar guion
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Pedile ajustes en lenguaje natural. Se crea una nueva versión sin
          perder la anterior.
        </p>
        <textarea
          ref={refineRef}
          rows={2}
          className={inputCls}
          placeholder='Ej: "Hacé el gancho más agresivo y acortá la historia a la mitad"'
          disabled={refining || editing}
        />
        <div className="flex items-center justify-between mt-3">
          <button
            className={btnPrimary}
            onClick={handleRefine}
            disabled={refining || editing}
            title={editing ? "Cerrá el editor para refinar" : undefined}
          >
            {refining ? "Refinando…" : <>Refinar <ArrowRight size={15} strokeWidth={1.75} /> nueva versión</>}
          </button>
          {script.outcome !== "lost" && script.outcome !== "won" && (
            <button
              className="text-xs text-slate-400 hover:text-rose-600"
              onClick={() => markOutcome("lost")}
            >
              Marcar como “no convirtió”
            </button>
          )}
        </div>
      </Card>

      <div className="mt-6 space-y-6">
        <HookLab scriptId={script.id} />
        <CritiquePanel
          scriptId={script.id}
          versionId={current?.id ?? null}
          onApplySuggestion={(text) => {
            setPinnedSuggestions((prev) =>
              prev.includes(text) ? prev : [...prev, text]
            );
            setEditing(true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
        <LearningsPanel scriptId={script.id} outcome={script.outcome} />
      </div>

      <div className="mt-6">
        <Link href="/guiones" className="text-sm text-brand-blue hover:underline">
          <ArrowLeft className="mr-1 inline" size={15} strokeWidth={1.75} /> Volver a guiones
        </Link>
      </div>
      <ConfirmDialog
        open={templateDialogOpen}
        onClose={() => setTemplateDialogOpen(false)}
        onConfirm={saveAsTemplate}
        title="Guardar como plantilla"
        message="Elegí un nombre claro para encontrarla y reutilizarla después."
        confirmLabel="Guardar plantilla"
      >
        <Input value={templateTitle} onChange={(event) => setTemplateTitle(event.target.value)} autoFocus aria-label="Nombre de la plantilla" />
      </ConfirmDialog>
    </div>
  );
}

export default function GuionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense fallback={<div aria-label="Cargando guion"><Skeleton className="h-8 w-72" /><Skeleton className="mt-6 h-96 w-full" /></div>}>
      <GuionDetail id={id} />
    </Suspense>
  );
}
