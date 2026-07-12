"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ScriptMarkdown from "@/components/ScriptMarkdown";
import { AsyncStatus, Button, Card, CopyButton, PageTitle, inputCls, type ProcessStatus } from "@/components/ui";
import { Check, Microscope } from "lucide-react";
import { toast } from "sonner";

type Client = { id: number; name: string };

export default function AnalizadorPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sourceUrl, setSourceUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [output, setOutput] = useState("");
  const [savedDocId, setSavedDocId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState<ProcessStatus | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const response = await fetch("/api/analyze/import-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No se pudo importar la URL");
      setTranscript(data.text);
      if (titleRef.current && !titleRef.current.value.trim()) {
        titleRef.current.value = data.title;
      }
      toast.success("Transcript importado. Podés revisarlo antes de analizar.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function handleAnalyze(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setAnalyzing(true);
    setOutput("");
    setError(null);
    setAiStatus({ stage: "Preparando arnés 5+1" });
    setSavedDocId(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fd.get("title"),
          transcript: fd.get("transcript"),
          clientId: fd.get("clientId") ? Number(fd.get("clientId")) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al analizar");
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
            setAiStatus({ stage: data.stage, completed: data.completed, total: data.total });
          } else if (data.type === "delta") {
            setOutput((prev) => prev + data.text);
            outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
          } else if (data.type === "done") {
            setSavedDocId(data.documentId);
            toast.success("Análisis guardado en la biblioteca");
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        }
      }
      setAnalyzing(false);
    } catch (err) {
      setAnalyzing(false);
      setError((err as Error).message);
    }
  }

  return (
    <div className="max-w-4xl">
      <PageTitle
        title="Analizador de VSLs"
        subtitle="Pegá el transcript de un VSL de la competencia y obtené su ingeniería persuasiva: framework, beats, ganchos, objeciones y qué vale la pena adaptar. El análisis se guarda en la biblioteca."
      />

      <Card className="p-6 mb-6">
        <form onSubmit={handleAnalyze} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div>
              <label htmlFor="analysis-title" className="block text-xs font-semibold text-slate-600 mb-1">
                Título / referencia *
              </label>
              <input
                id="analysis-title"
                ref={titleRef}
                name="title"
                required
                className={inputCls}
                placeholder="Ej: VSL competidor X — oferta de enero"
              />
            </div>
            <div>
              <label htmlFor="analysis-client" className="block text-xs font-semibold text-slate-600 mb-1">
                Asociar a cliente (opcional)
              </label>
              <select id="analysis-client" name="clientId" className={inputCls}>
                <option value="">Biblioteca global</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="analysis-url" className="mb-1 block text-xs font-semibold text-slate-600">
              Importar desde URL
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="analysis-url"
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                className={inputCls}
                placeholder="https://youtube.com/watch?v=…"
                aria-label="URL para importar"
              />
              <Button
                type="button"
                variant="secondary"
                className="shrink-0"
                onClick={handleImport}
                disabled={!sourceUrl.trim()}
                loading={importing}
                loadingLabel="Importando…"
              >
                Importar transcript
              </Button>
            </div>
          </div>
          <div>
            <label htmlFor="analysis-transcript" className="block text-xs font-semibold text-slate-600 mb-1">
              Transcript del VSL *
            </label>
            <textarea
              id="analysis-transcript"
              name="transcript"
              required
              rows={10}
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              className={inputCls}
              placeholder="Pegá aquí el transcript completo del VSL a analizar…"
            />
          </div>
          <Button type="submit" loading={analyzing} loadingLabel="Analizando…" icon={<Microscope size={16} strokeWidth={1.75} />}>Analizar VSL</Button>
        </form>
      </Card>

      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4">
          {error}
        </div>
      )}

      {(output || analyzing) && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-navy">
              Análisis estructural
            </h2>
            {analyzing ? (
              <AsyncStatus status={aiStatus} fallback="Los modelos están trabajando" />
            ) : output ? (
              <CopyButton text={output} label="Copiar análisis" copiedLabel="Análisis copiado" />
            ) : null}
            {savedDocId && (
              <Link
                href="/biblioteca"
                className="text-xs text-emerald-600 hover:underline"
              >
                <Check className="inline" size={14} strokeWidth={1.75} /> Guardado en la biblioteca
              </Link>
            )}
          </div>
          <div ref={outputRef} className="max-h-[65vh] overflow-y-auto">
            <ScriptMarkdown content={output || "…"} />
          </div>
        </Card>
      )}
    </div>
  );
}
