"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import ScriptMarkdown from "@/components/ScriptMarkdown";
import HookLab from "@/components/HookLab";
import CritiquePanel from "@/components/CritiquePanel";
import LearningsPanel from "@/components/LearningsPanel";
import {
  Badge,
  Card,
  PageTitle,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "@/components/ui";

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
  usage: Usage;
  createdAt: string;
};

type ScriptDetail = {
  id: number;
  title: string;
  status: string;
  outcome: string;
  provider: string;
  model: string;
  client: { id: number; name: string } | null;
  framework: { id: number; name: string } | null;
  versions: Version[];
};

export default function GuionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [script, setScript] = useState<ScriptDetail | null>(null);
  const [activeVersion, setActiveVersion] = useState<number | null>(null);
  const [refining, setRefining] = useState(false);
  const [refineOutput, setRefineOutput] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [promoted, setPromoted] = useState(false);
  const refineRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const data = await (await fetch(`/api/scripts/${id}`)).json();
    setScript(data);
    if (data.versions?.length) {
      setActiveVersion(data.versions[data.versions.length - 1].versionNumber);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const current = script?.versions.find(
    (v) => v.versionNumber === activeVersion
  );

  async function handleRefine() {
    const instruction = refineRef.current?.value.trim();
    if (!instruction || !script) return;
    setRefining(true);
    setRefineOutput("");
    setError(null);
    setAiStatus("Preparando arnés 5+1");

    try {
      const res = await fetch(`/api/scripts/${script.id}/refine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
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

  async function promote(scope: "client" | "global") {
    const res = await fetch(`/api/scripts/${id}/promote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope }),
    });
    if (res.ok) {
      setPromoted(true);
      load();
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

  if (!script) return <div className="text-sm text-slate-400">Cargando…</div>;

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
        subtitle={`${script.client?.name ?? "—"}${script.framework ? ` · ${script.framework.name}` : ""} · ${script.model}`}
        actions={
          <div className="flex gap-2">
            <Link
              href={`/guiones/${id}/teleprompter`}
              className={btnSecondary}
            >
              ▶ Teleprompter
            </Link>
            <button className={btnSecondary} onClick={exportMd}>
              ⬇ Exportar .md
            </button>
            {script.outcome !== "won" ? (
              <button className={btnPrimary} onClick={() => markOutcome("won")}>
                ★ Marcar ganador
              </button>
            ) : (
              <Badge tone="green">★ Guion ganador</Badge>
            )}
          </div>
        }
      />

      {script.outcome === "won" && !promoted && (
        <Card className="p-4 mb-4 flex items-center justify-between bg-emerald-50 border-emerald-200">
          <span className="text-sm text-emerald-800">
            Este guion convirtió. Promovelo a la biblioteca para que sirva de
            ejemplo en futuras generaciones.
          </span>
          <div className="flex gap-2">
            <button className={btnSecondary} onClick={() => promote("client")}>
              Solo para {script.client?.name}
            </button>
            <button className={btnPrimary} onClick={() => promote("global")}>
              Biblioteca global
            </button>
          </div>
        </Card>
      )}
      {promoted && (
        <Card className="p-4 mb-4 text-sm text-emerald-800 bg-emerald-50 border-emerald-200">
          ✓ Promovido a la biblioteca como guion ganador.
        </Card>
      )}

      <div className="flex gap-2 mb-4 items-center">
        <span className="text-xs text-slate-500">Versiones:</span>
        {script.versions.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveVersion(v.versionNumber)}
            title={v.refinementInstruction ?? "Versión original"}
            className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
              v.versionNumber === activeVersion
                ? "bg-brand-blue text-white border-brand-blue"
                : "bg-white text-slate-600 border-slate-300 hover:border-brand-blue"
            }`}
          >
            v{v.versionNumber}
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
          disabled={refining}
        />
        <div className="flex items-center justify-between mt-3">
          <button className={btnPrimary} onClick={handleRefine} disabled={refining}>
            {refining ? "Refinando…" : "Refinar → nueva versión"}
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
        <CritiquePanel scriptId={script.id} versionId={current?.id ?? null} />
        <LearningsPanel scriptId={script.id} outcome={script.outcome} />
      </div>

      <div className="mt-6">
        <Link href="/guiones" className="text-sm text-brand-blue hover:underline">
          ← Volver a guiones
        </Link>
      </div>
    </div>
  );
}
