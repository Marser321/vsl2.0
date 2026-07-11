"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ScriptMarkdown from "@/components/ScriptMarkdown";
import {
  Badge,
  Card,
  KIND_LABELS,
  KIND_TONES,
  PageTitle,
  btnPrimary,
  btnSecondary,
  inputCls,
} from "@/components/ui";

type Client = { id: number; name: string };
type Framework = { id: number; name: string; description: string | null };
type Doc = {
  id: number;
  title: string;
  kind: string;
  clientId: number | null;
  tokenCount: number;
};

const TOKEN_BUDGET = 150_000;

function GenerarWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [clients, setClients] = useState<Client[]>([]);
  const [frameworksList, setFrameworksList] = useState<Framework[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);

  const [clientId, setClientId] = useState<number | null>(
    searchParams.get("clientId") ? Number(searchParams.get("clientId")) : null
  );
  const brandId = searchParams.get("brandId") ? Number(searchParams.get("brandId")) : null;
  const offerId = searchParams.get("offerId") ? Number(searchParams.get("offerId")) : null;
  const campaignId = searchParams.get("campaignId") ? Number(searchParams.get("campaignId")) : null;
  const [frameworkId, setFrameworkId] = useState<number | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<Set<number>>(new Set());

  const [generating, setGenerating] = useState(false);
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [aiStatus, setAiStatus] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  // Brief autopilot: pre-llenado con IA a partir de los docs del cliente
  const [autofill, setAutofill] = useState<Record<string, string> | null>(null);
  const [autofillKey, setAutofillKey] = useState(0);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  async function handleAutofill() {
    if (!clientId) return;
    setAutofilling(true);
    setAutofillError(null);
    const res = await fetch("/api/brief-autofill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId }),
    });
    const data = await res.json();
    setAutofilling(false);
    if (!res.ok) {
      setAutofillError(data.error || "Error al pre-llenar");
      return;
    }
    setAutofill(data);
    setAutofillKey((k) => k + 1); // remonta los campos con los nuevos defaults
  }

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then(setClients);
    fetch("/api/frameworks")
      .then((r) => r.json())
      .then(setFrameworksList);
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    fetch(`/api/campaigns/${campaignId}/generation-brief`)
      .then((response) => response.json())
      .then((data) => {
        if (data.error) return;
        setAutofill(data);
        setAutofillKey((key) => key + 1);
      });
  }, [campaignId]);

  useEffect(() => {
    if (!clientId) return;
    fetch(`/api/documents?suggestedFor=${clientId}`)
      .then((r) => r.json())
      .then((d: Doc[]) => {
        setDocs(d);
        setSelectedDocs(new Set(d.map((x) => x.id)));
      });
  }, [clientId]);

  const selectedTokens = useMemo(
    () =>
      docs
        .filter((d) => selectedDocs.has(d.id))
        .reduce((s, d) => s + d.tokenCount, 0),
    [docs, selectedDocs]
  );

  function toggleDoc(id: number) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setGenerating(true);
    setOutput("");
    setError(null);
    setAiStatus("Preparando arnés 5+1");
    setStep(4);

    const payload = {
      clientId,
      brandId,
      offerId,
      campaignId,
      frameworkId,
      documentIds: Array.from(selectedDocs),
      title: (fd.get("title") as string) || "Guion sin título",
      brief: {
        producto: fd.get("producto") as string,
        audiencia: fd.get("audiencia") as string,
        oferta: fd.get("oferta") as string,
        dolores: fd.get("dolores") as string,
        objeciones: (fd.get("objeciones") as string) || "",
        duracionMin: Number(fd.get("duracionMin") || 10),
        tono: (fd.get("tono") as string) || "",
        cta: fd.get("cta") as string,
        instruccionesExtra: (fd.get("instruccionesExtra") as string) || "",
      },
    };

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al generar");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let scriptId: number | null = null;

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
            outputRef.current?.scrollTo({
              top: outputRef.current.scrollHeight,
            });
          } else if (data.type === "done") {
            scriptId = data.scriptId;
          } else if (data.type === "error") {
            throw new Error(data.message);
          }
        }
      }

      setGenerating(false);
      if (scriptId) {
        setTimeout(() => router.push(`/guiones/${scriptId}`), 800);
      }
    } catch (err) {
      setGenerating(false);
      setError((err as Error).message);
    }
  }

  const steps = ["Cliente", "Framework", "Brief y documentos", "Generación"];

  return (
    <div className="max-w-4xl">
      <PageTitle
        title="Generar guion de VSL"
        subtitle="El contexto del cliente + la biblioteca de la agencia alimentan cada generación"
      />

      {/* Indicador de pasos */}
      <div className="flex gap-2 mb-8">
        {steps.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1.5 rounded-full mb-1.5 ${i + 1 <= step ? "bg-brand-blue" : "bg-slate-200"}`}
            />
            <div
              className={`text-xs ${i + 1 === step ? "font-semibold text-brand-navy" : "text-slate-400"}`}
            >
              {i + 1}. {label}
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="p-6">
          <h2 className="font-semibold text-brand-navy mb-4">
            ¿Para qué cliente es el guion?
          </h2>
          {clients.length === 0 ? (
            <p className="text-sm text-slate-400">
              No hay clientes.{" "}
              <a href="/clientes" className="text-brand-blue underline">
                Creá uno primero
              </a>
              .
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClientId(c.id);
                    setStep(2);
                  }}
                  className={`rounded-lg border p-4 text-left text-sm font-medium transition-colors ${
                    clientId === c.id
                      ? "border-brand-blue bg-blue-50"
                      : "border-slate-200 hover:border-brand-blue"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6">
          <h2 className="font-semibold text-brand-navy mb-4">
            ¿Qué estructura usamos?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {frameworksList.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setFrameworkId(f.id);
                  setStep(3);
                }}
                className={`rounded-lg border p-4 text-left transition-colors ${
                  frameworkId === f.id
                    ? "border-brand-blue bg-blue-50"
                    : "border-slate-200 hover:border-brand-blue"
                }`}
              >
                <div className="text-sm font-semibold text-brand-navy">
                  {f.name}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {f.description}
                </div>
              </button>
            ))}
            <button
              onClick={() => {
                setFrameworkId(null);
                setStep(3);
              }}
              className="rounded-lg border border-dashed border-slate-300 p-4 text-left text-sm text-slate-500 hover:border-brand-blue"
            >
              Dejar que la IA elija la mejor estructura
            </button>
          </div>
          <button className={`${btnSecondary} mt-4`} onClick={() => setStep(1)}>
            ← Volver
          </button>
        </Card>
      )}

      {step === 3 && (
        <form onSubmit={handleGenerate} className="space-y-6">
          <Card className="p-6 space-y-4" key={autofillKey}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-navy">Brief del guion</h2>
              <button
                type="button"
                className={btnSecondary}
                onClick={handleAutofill}
                disabled={autofilling}
                title="La IA lee los documentos del cliente y pre-llena el brief"
              >
                {autofilling ? "Leyendo documentos…" : "⚡ Pre-llenar con IA"}
              </button>
            </div>
            {autofillError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-800">
                {autofillError}
              </div>
            )}
            {autofill && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-brand-navy">
                ⚡ Brief pre-llenado desde los documentos del cliente — revisá y
                corregí antes de generar.
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Título interno del guion *
              </label>
              <input
                name="title"
                required
                className={inputCls}
                placeholder="Ej: VSL lanzamiento curso — enero"
                defaultValue={autofill?.title ?? ""}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Producto / servicio *
                </label>
                <textarea name="producto" required rows={2} className={inputCls} defaultValue={autofill?.producto ?? ""} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Audiencia / avatar *
                </label>
                <textarea name="audiencia" required rows={2} className={inputCls} defaultValue={autofill?.audiencia ?? ""} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Oferta (precio, bonos, garantía) *
                </label>
                <textarea name="oferta" required rows={2} className={inputCls} defaultValue={autofill?.oferta ?? ""} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Dolores principales *
                </label>
                <textarea name="dolores" required rows={2} className={inputCls} defaultValue={autofill?.dolores ?? ""} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Objeciones a manejar
                </label>
                <textarea name="objeciones" rows={2} className={inputCls} defaultValue={autofill?.objeciones ?? ""} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  CTA (llamado a la acción) *
                </label>
                <input name="cta" required className={inputCls} defaultValue={autofill?.cta ?? ""} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Duración objetivo (minutos)
                </label>
                <input
                  name="duracionMin"
                  type="number"
                  defaultValue={autofill?.duracionMin ?? 10}
                  min={1}
                  max={60}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Tono
                </label>
                <input
                  name="tono"
                  className={inputCls}
                  placeholder="Ej: directo y emocional, cercano, autoridad"
                  defaultValue={autofill?.tono ?? ""}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Instrucciones adicionales
              </label>
              <textarea name="instruccionesExtra" rows={2} className={inputCls} defaultValue={autofill?.instruccionesExtra ?? ""} />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-brand-navy">
                Documentos de contexto
              </h2>
              <span
                className={`text-xs ${selectedTokens > TOKEN_BUDGET ? "text-rose-600 font-semibold" : "text-slate-500"}`}
              >
                {selectedTokens.toLocaleString("es")} tokens seleccionados
                {selectedTokens > TOKEN_BUDGET &&
                  ` — supera el presupuesto de ${TOKEN_BUDGET.toLocaleString("es")}`}
              </span>
            </div>
            {docs.length === 0 ? (
              <p className="text-sm text-slate-400">
                Este cliente no tiene documentos. El guion se generará solo con
                el brief (subí briefs y guiones ganadores para mejorar la
                calidad).
              </p>
            ) : (
              <ul className="space-y-2">
                {docs.map((d) => (
                  <li key={d.id}>
                    <label className="flex items-center gap-3 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDocs.has(d.id)}
                        onChange={() => toggleDoc(d.id)}
                        className="accent-[#488eff]"
                      />
                      <Badge tone={KIND_TONES[d.kind] ?? "gray"}>
                        {KIND_LABELS[d.kind] ?? d.kind}
                      </Badge>
                      <span className="flex-1">{d.title}</span>
                      {d.clientId === null && (
                        <span className="text-[10px] text-slate-400">
                          global
                        </span>
                      )}
                      <span className="text-xs text-slate-400">
                        {d.tokenCount.toLocaleString("es")} tk
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex gap-3">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setStep(2)}
            >
              ← Volver
            </button>
            <button type="submit" className={btnPrimary}>
              ✦ Generar guion
            </button>
          </div>
        </form>
      )}

      {step === 4 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-navy">
              {generating ? "Generando guion…" : error ? "Error" : "¡Listo!"}
            </h2>
            {generating && (
              <span className="text-xs text-brand-blue animate-pulse">
                {aiStatus || "Los modelos están trabajando"}
              </span>
            )}
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4">
              {error}
              <button
                className={`${btnSecondary} mt-3 block`}
                onClick={() => setStep(3)}
              >
                ← Volver al brief
              </button>
            </div>
          )}
          <div
            ref={outputRef}
            className="max-h-[60vh] overflow-y-auto rounded-lg bg-brand-mist p-5"
          >
            <ScriptMarkdown content={output || "…"} />
          </div>
          {!generating && !error && (
            <p className="text-xs text-slate-400 mt-3">
              Guardado. Redirigiendo al editor…
            </p>
          )}
        </Card>
      )}
    </div>
  );
}

export default function GenerarPage() {
  return (
    <Suspense>
      <GenerarWizard />
    </Suspense>
  );
}
