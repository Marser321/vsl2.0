"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ScriptMarkdown from "@/components/ScriptMarkdown";
import { Card, PageTitle, btnPrimary, inputCls } from "@/components/ui";

type Client = { id: number; name: string };

export default function AnalizadorPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [output, setOutput] = useState("");
  const [savedDocId, setSavedDocId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
  }, []);

  async function handleAnalyze(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setAnalyzing(true);
    setOutput("");
    setError(null);
    setAiStatus("Preparando arnés 5+1");
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
            setAiStatus(`${data.stage} (${data.completed}/${data.total})`);
          } else if (data.type === "delta") {
            setOutput((prev) => prev + data.text);
            outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
          } else if (data.type === "done") {
            setSavedDocId(data.documentId);
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Título / referencia *
              </label>
              <input
                name="title"
                required
                className={inputCls}
                placeholder="Ej: VSL competidor X — oferta de enero"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Asociar a cliente (opcional)
              </label>
              <select name="clientId" className={inputCls}>
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
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Transcript del VSL *
            </label>
            <textarea
              name="transcript"
              required
              rows={10}
              className={inputCls}
              placeholder="Pegá aquí el transcript completo del VSL a analizar…"
            />
          </div>
          <button className={btnPrimary} disabled={analyzing}>
            {analyzing ? "Analizando…" : "🔬 Analizar VSL"}
          </button>
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
            {analyzing && (
              <span className="text-xs text-brand-blue animate-pulse">
                {aiStatus || "Los modelos están trabajando"}
              </span>
            )}
            {savedDocId && (
              <Link
                href="/biblioteca"
                className="text-xs text-emerald-600 hover:underline"
              >
                ✓ Guardado en la biblioteca
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
