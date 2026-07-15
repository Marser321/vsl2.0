"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Clapperboard, Smartphone, Sparkles, Star, Zap } from "lucide-react";
import ScriptMarkdown from "@/components/ScriptMarkdown";
import {
  Badge,
  AsyncStatus,
  Button,
  Card,
  ConfirmDialog,
  CopyButton,
  InlineAlert,
  KIND_LABELS,
  KIND_TONES,
  PageTitle,
  btnPrimary,
  btnSecondary,
  inputCls,
  type ProcessStatus,
} from "@/components/ui";
import { fetchJson } from "@/lib/http/fetch-json";
import {
  generationFieldErrors,
  generationInputSchema,
  type GenerationInput,
} from "@/lib/generation/schema";

type Client = { id: number; name: string };
type Framework = { id: number; name: string; description: string | null };
type Doc = {
  id: number;
  title: string;
  kind: string;
  clientId: number | null;
  tokenCount: number;
  tags: string[];
  avgRating?: number | null;
  bestHookRate?: number | null;
  bestMetric?: {
    platform: "meta" | "tiktok" | "youtube" | "otro";
    hookRate: number;
    ctr: number | null;
    cpa: number | null;
    impressions: number | null;
    versionNumber: number;
  } | null;
  qualityConflict?: boolean;
  preselect?: boolean;
};

type FrameworkStat = { frameworkId: number | null; n: number; avgScore: number };
type Preflight = {
  provider: "anthropic" | "openrouter";
  providerLabel: string;
  model: string;
  available: boolean;
  keyAvailable: boolean;
  callsPerRun: number;
  quota: { used: number; remaining: number; limit: number } | null;
  setup: { frameworkCount: number; hasFrameworks: boolean; hasSystemPrompt: boolean };
};
type Readiness = {
  readyToGenerate: boolean;
  database: { available: boolean; error: string | null };
  provider: { label: string; model: string; available: boolean; error: string | null };
  prompt: { available: boolean; error: string | null };
  transcription: { available: boolean; model: string; error: string | null };
  publicUrl: { available: boolean; url: string | null; error: string | null };
};
type Recovery = { id: number; title: string; status: string; generationError?: string | null; versions?: Array<{ content: string }> };
type StoredDraft = {
  step: number;
  format: "vsl" | "reel";
  clientId: number | null;
  frameworkId: number | null;
  selectedDocs: number[];
  fields: Record<string, string>;
  activeScriptId?: number;
};

const TOKEN_BUDGET = 150_000;
const DRAFT_KEY = "vsl-studio:generation-draft:v1";

function GenerarWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState(1);
  const [format, setFormat] = useState<"vsl" | "reel">("vsl");
  const [clients, setClients] = useState<Client[]>([]);
  const [frameworksList, setFrameworksList] = useState<Framework[]>([]);
  const [frameworkStats, setFrameworkStats] = useState<FrameworkStat[]>([]);
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [aiStatus, setAiStatus] = useState<ProcessStatus | null>(null);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);
  const [pendingPayload, setPendingPayload] = useState<GenerationInput | null>(null);
  const [openrouterAccepted, setOpenrouterAccepted] = useState(false);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const submittingRef = useRef(false);
  const restoredDocsRef = useRef<number[] | null>(null);
  const requestedDocumentId = searchParams.get("documentId") ? Number(searchParams.get("documentId")) : null;

  function loadReadiness() {
    setReadinessError(null);
    fetchJson<Readiness>("/api/readiness")
      .then(setReadiness)
      .catch((cause) => setReadinessError((cause as Error).message));
  }

  useEffect(() => { loadReadiness(); }, []);

  // Brief autopilot: pre-llenado con IA a partir de los docs del cliente
  const [autofill, setAutofill] = useState<Record<string, string> | null>(null);
  const [autofillKey, setAutofillKey] = useState(0);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillError, setAutofillError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as StoredDraft;
      setFormat(draft.format ?? "vsl");
      setClientId(draft.clientId ?? null);
      setFrameworkId(draft.frameworkId ?? null);
      restoredDocsRef.current = draft.selectedDocs ?? [];
      if (draft.fields && Object.keys(draft.fields).length) {
        setAutofill(draft.fields);
        setAutofillKey((key) => key + 1);
        setStep(Math.min(4, Math.max(1, draft.step || 4)));
      }
      if (draft.activeScriptId) {
        fetchJson<Recovery>(`/api/scripts/${draft.activeScriptId}`)
          .then(setRecovery)
          .catch(() => setRecovery({ id: draft.activeScriptId!, title: "Generación interrumpida", status: "interrupted" }));
      }
    } catch {
      localStorage.removeItem(DRAFT_KEY);
    }
  }, []);

  useEffect(() => {
    if (step !== 4) return;
    setPreflightError(null);
    fetchJson<Preflight>("/api/generation-preflight")
      .then(setPreflight)
      .catch((cause) => setPreflightError((cause as Error).message));
  }, [step]);

  async function handleAutofill() {
    if (!clientId) return;
    setAutofilling(true);
    setAutofillError(null);
    try {
      const data = await fetchJson<Record<string, string>>("/api/brief-autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId }),
      }, 60_000);
      setAutofill(data);
      setAutofillKey((k) => k + 1);
    } catch (cause) {
      setAutofillError((cause as Error).message);
    } finally {
      setAutofilling(false);
    }
  }

  useEffect(() => {
    fetchJson<Client[]>("/api/clients")
      .then(setClients)
      .catch((cause) => setReadinessError((cause as Error).message));
  }, []);

  useEffect(() => {
    fetchJson<Framework[]>(`/api/frameworks?format=${format}`)
      .then(setFrameworksList)
      .catch((cause) => setReadinessError((cause as Error).message));
    fetchJson<{ byFramework?: FrameworkStat[] }>(`/api/stats?format=${format}`)
      .then((s) => setFrameworkStats(s.byFramework ?? []))
      .catch(() => setFrameworkStats([]));
  }, [format]);

  useEffect(() => {
    if (!campaignId) return;
    fetchJson<Record<string, string> & { error?: string }>(`/api/campaigns/${campaignId}/generation-brief`)
      .then((data) => {
        if (data.error) return;
        setAutofill(data);
        setAutofillKey((key) => key + 1);
      })
      .catch((cause) => setReadinessError((cause as Error).message));
  }, [campaignId]);

  // Prefill desde una plantilla (?templateId=): formato + framework + brief base.
  const templateIdParam = searchParams.get("templateId");
  useEffect(() => {
    if (!templateIdParam) return;
    fetchJson<Array<{
      id: number;
      format: "vsl" | "reel";
      frameworkId: number | null;
      briefDefaults: Record<string, unknown>;
    }>>("/api/templates")
      .then(
        (list) => {
          const t = list.find((x) => x.id === Number(templateIdParam));
          if (!t) return;
          setFormat(t.format);
          setFrameworkId(t.frameworkId);
          const strings: Record<string, string> = {};
          for (const [k, v] of Object.entries(t.briefDefaults)) {
            if (typeof v === "string" && v) strings[k] = v;
            else if (typeof v === "number") strings[k] = String(v);
          }
          setAutofill(strings);
          setAutofillKey((key) => key + 1);
          setStep(2);
        }
      )
      .catch((cause) => setReadinessError((cause as Error).message));
  }, [templateIdParam]);

  useEffect(() => {
    if (!clientId) return;
    fetchJson<Doc[]>(`/api/documents?suggestedFor=${clientId}`)
      .then((d: Doc[]) => {
        setDocs(d);
        // Los ejemplares mal puntuados por el equipo quedan destildados por defecto.
        const restored = restoredDocsRef.current;
        const defaults = restored ?? d.filter((x) => x.preselect !== false).map((x) => x.id);
        if (requestedDocumentId && d.some((doc) => doc.id === requestedDocumentId)) defaults.push(requestedDocumentId);
        setSelectedDocs(new Set(defaults));
        restoredDocsRef.current = null;
      })
      .catch((cause) => setReadinessError((cause as Error).message));
  }, [clientId, requestedDocumentId]);

  const selectedTokens = useMemo(
    () =>
      docs
        .filter((d) => selectedDocs.has(d.id))
        .reduce((s, d) => s + d.tokenCount, 0),
    [docs, selectedDocs]
  );
  const documentGroups = useMemo(() => {
    const exemplars = docs.filter((doc) => doc.kind === "winning_script");
    const freshReferences = docs.filter(
      (doc) =>
        doc.kind !== "winning_script" &&
        (doc.kind === "transcript" || doc.kind === "reference" || doc.tags.includes("radar"))
    );
    const clientContext = docs.filter(
      (doc) => !exemplars.includes(doc) && !freshReferences.includes(doc)
    );
    return [
      { key: "context", label: "Contexto del cliente", items: clientContext },
      { key: "fresh", label: "Radar, transcripts y referencias", items: freshReferences },
      { key: "exemplars", label: "Ejemplares con señales de calidad", items: exemplars },
    ].filter((group) => group.items.length > 0);
  }, [docs]);
  const selectedSummary = useMemo(() => {
    const selected = docs.filter((doc) => selectedDocs.has(doc.id));
    return {
      total: selected.length,
      radar: selected.filter((doc) => doc.tags.includes("radar")).length,
      transcripts: selected.filter((doc) => doc.kind === "transcript").length,
      validated: selected.filter((doc) => doc.kind === "winning_script" && doc.bestMetric).length,
    };
  }, [docs, selectedDocs]);

  function toggleDoc(id: number) {
    setSelectedDocs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function saveDraft(form?: HTMLFormElement, activeScriptId?: number) {
    const fields = form
      ? Object.fromEntries(Array.from(new FormData(form).entries()).filter(([, value]) => typeof value === "string")) as Record<string, string>
      : autofill ?? {};
    const draft: StoredDraft = {
      step,
      format,
      clientId,
      frameworkId,
      selectedDocs: Array.from(selectedDocs),
      fields,
      activeScriptId: activeScriptId ?? recovery?.id,
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function saveActiveScript(scriptId: number) {
    try {
      const current = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}") as Partial<StoredDraft>;
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...current, activeScriptId: scriptId }));
    } catch {
      // El siguiente cambio del formulario reconstruirá el draft.
    }
  }

  async function startGeneration(payload: GenerationInput, form: HTMLFormElement | null) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setGenerating(true);
    setOutput("");
    setError(null);
    setAiStatus({ stage: `Preparando ${preflight?.providerLabel ?? "el proveedor"}` });
    setStep(5);
    if (form) saveDraft(form);

    let scriptId: number | null = null;
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
      if (!res.body) throw new Error("El servidor no inició el stream de generación");

      const reader = res.body.getReader();
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
          if (data.type === "started") {
            scriptId = data.scriptId;
            setRecovery({ id: data.scriptId, title: payload.title, status: "generating" });
            saveActiveScript(data.scriptId);
          } else if (data.type === "status") {
            setAiStatus({ stage: data.stage, completed: data.completed, total: data.total });
          } else if (data.type === "delta") {
            setOutput((prev) => prev + data.text);
            outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
          } else if (data.type === "done") {
            scriptId = data.scriptId;
          } else if (data.type === "error") {
            scriptId = data.scriptId ?? scriptId;
            throw new Error(data.message);
          }
        }
      }

      setGenerating(false);
      if (!scriptId) throw new Error("El stream terminó sin confirmar el guardado");
      localStorage.removeItem(DRAFT_KEY);
      setTimeout(() => router.push(`/guiones/${scriptId}`), 800);
    } catch (cause) {
      setGenerating(false);
      const message = (cause as Error).message;
      setError(scriptId ? `${message} El contenido recibido quedó guardado como borrador.` : message);
      if (scriptId) setRecovery({ id: scriptId, title: payload.title, status: "failed", generationError: message });
    } finally {
      submittingRef.current = false;
    }
  }

  async function handleGenerate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!preflight) {
      setPreflightError("Todavía estamos verificando el proveedor. Reintentá en un momento.");
      return;
    }
    const candidate = {
      clientId,
      brandId,
      offerId,
      campaignId,
      frameworkId,
      documentIds: Array.from(selectedDocs),
      title: String(fd.get("title") ?? ""),
      format,
      provider: preflight.provider,
      model: preflight.model,
      openrouterConfirmed: true,
      brief: {
        producto: fd.get("producto") as string,
        audiencia: fd.get("audiencia") as string,
        oferta: fd.get("oferta") as string,
        dolores: fd.get("dolores") as string,
        objeciones: (fd.get("objeciones") as string) || "",
        duracionMin: format === "reel" ? 1 : Number(fd.get("duracionMin") || 10),
        ...(format === "reel"
          ? {
              duracionSeg: Number(fd.get("duracionSeg") || 45),
              plataforma: (fd.get("plataforma") as "tiktok" | "reels" | "shorts" | "") || "",
            }
          : {}),
        tono: (fd.get("tono") as string) || "",
        cta: fd.get("cta") as string,
        instruccionesExtra: (fd.get("instruccionesExtra") as string) || "",
      },
    };
    const parsed = generationInputSchema.safeParse(candidate);
    if (!parsed.success) {
      const errors = generationFieldErrors(parsed.error);
      setFieldErrors(errors);
      const first = Object.keys(errors)[0];
      const firstField = first ? e.currentTarget.elements.namedItem(first) as HTMLElement | null : null;
      firstField?.scrollIntoView({ block: "center" });
      firstField?.focus();
      return;
    }
    setFieldErrors({});
    saveDraft(e.currentTarget);
    if (!preflight.available) return;
    if (preflight.provider === "openrouter") {
      setOpenrouterAccepted(false);
      setPendingPayload(parsed.data);
      return;
    }
    await startGeneration(parsed.data, e.currentTarget);
  }

  const steps = ["Formato", "Cliente", "Brief y documentos", "Generación"];
  const displayStep = step >= 5 ? 4 : step >= 4 ? 3 : step;

  return (
    <div className="max-w-4xl">
      <PageTitle
        title="Generar guion"
        subtitle="El contexto del cliente + la biblioteca de la agencia alimentan cada generación"
      />

      <Card className="mb-6 p-4">
        {readinessError ? (
          <InlineAlert tone="danger"><div><strong>No pudimos verificar el sistema.</strong><p className="mt-1">{readinessError}</p><button type="button" className={`${btnSecondary} mt-3`} onClick={loadReadiness}>Reintentar diagnóstico</button></div></InlineAlert>
        ) : !readiness ? (
          <AsyncStatus status={{ stage: "Verificando base, proveedor y configuración" }} fallback="Verificando sistema" />
        ) : (
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Badge tone={readiness.database.available ? "green" : "red"}>Base {readiness.database.available ? "lista" : "bloqueada"}</Badge>
            <Badge tone={readiness.provider.available ? "green" : "red"}>{readiness.provider.label} {readiness.provider.available ? "listo" : "bloqueado"}</Badge>
            <Badge tone={readiness.prompt.available ? "green" : "red"}>Prompt {readiness.prompt.available ? "listo" : "faltante"}</Badge>
            <span className="min-w-48 flex-1 text-slate-500">{readiness.readyToGenerate ? `Todo listo · ${readiness.provider.model}` : readiness.database.error || readiness.provider.error || readiness.prompt.error}</span>
            {!readiness.readyToGenerate && <a href="/configuracion" className={btnSecondary}>Abrir Configuración</a>}
          </div>
        )}
      </Card>

      {recovery && (
        <div className="mb-6">
          <InlineAlert tone={recovery.status === "draft" ? "success" : "warning"}>
            <div className="font-semibold">
              {recovery.status === "generating" ? "Hay una generación en curso" : "Hay un borrador recuperable"}
            </div>
            <p className="mt-1">
              {recovery.generationError || "El contenido guardado no se perdió. Podés abrirlo y, si se interrumpió, reintentarlo desde el editor."}
            </p>
            <a className={`${btnSecondary} mt-3 inline-flex`} href={`/guiones/${recovery.id}`}>
              Abrir borrador
            </a>
          </InlineAlert>
        </div>
      )}

      {/* Indicador de pasos */}
      <div className="flex gap-2 mb-8">
        {steps.map((label, i) => (
          <div key={label} className="flex-1">
            <div
              className={`h-1.5 rounded-full mb-1.5 ${i + 1 <= displayStep ? "bg-brand-blue" : "bg-slate-200"}`}
            />
            <div
              className={`text-xs ${i + 1 === displayStep ? "font-semibold text-brand-navy" : "text-slate-400"}`}
            >
              {i + 1}. {label}
            </div>
          </div>
        ))}
      </div>

      {step === 1 && (
        <Card className="p-6">
          <h2 className="font-semibold text-brand-navy mb-4">
            ¿Qué formato vamos a escribir?
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                if (format !== "vsl") setFrameworkId(null);
                setFormat("vsl");
                setStep(2);
              }}
              className={`rounded-lg border p-5 text-left transition-colors ${
                format === "vsl"
                  ? "border-brand-blue bg-blue-50"
                  : "border-slate-200 hover:border-brand-blue"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy"><Clapperboard size={17} strokeWidth={1.75} />VSL</div>
              <div className="text-xs text-slate-500 mt-1">
                Video de ventas largo. Se mide en minutos: historia, mecanismo,
                oferta y cierre completos.
              </div>
            </button>
            <button
              onClick={() => {
                if (format !== "reel") setFrameworkId(null);
                setFormat("reel");
                setStep(2);
              }}
              className={`rounded-lg border p-5 text-left transition-colors ${
                format === "reel"
                  ? "border-brand-blue bg-blue-50"
                  : "border-slate-200 hover:border-brand-blue"
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-navy"><Smartphone size={17} strokeWidth={1.75} />Reel</div>
              <div className="text-xs text-slate-500 mt-1">
                Vertical corto (15–90 segundos) para TikTok, Reels o Shorts.
                Guion por beats con visual y texto en pantalla.
              </div>
            </button>
          </div>
        </Card>
      )}

      {step === 2 && (
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {clients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setClientId(c.id);
                    setFrameworkId(null);
                    setStep(4);
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
          <button className={`${btnSecondary} mt-4`} onClick={() => setStep(1)}>
            <ArrowLeft size={16} strokeWidth={1.75} /> Volver
          </button>
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6">
          <h2 className="font-semibold text-brand-navy mb-4">
            ¿Qué estructura usamos?
          </h2>
          {!frameworksList.length && (
            <div className="mb-4">
              <InlineAlert tone="warning">
                No hay frameworks cargados. Podés continuar con estructura libre; un administrador puede ejecutar el seed para recuperar las estructuras recomendadas.
              </InlineAlert>
            </div>
          )}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {frameworksList.map((f) => {
              const stat = frameworkStats.find((s) => s.frameworkId === f.id);
              const eligible = frameworkStats.filter((s) => s.n >= 3);
              const isRecommended =
                stat &&
                stat.n >= 3 &&
                eligible.length > 0 &&
                stat.avgScore === Math.max(...eligible.map((s) => s.avgScore));
              return (
                <button
                  key={f.id}
                  onClick={() => {
                    setFrameworkId(f.id);
                    setStep(4);
                  }}
                  className={`rounded-lg border p-4 text-left transition-colors ${
                    frameworkId === f.id
                      ? "border-brand-blue bg-blue-50"
                      : "border-slate-200 hover:border-brand-blue"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-brand-navy flex-1">
                      {f.name}
                    </div>
                    {isRecommended && <Badge tone="green">Recomendado</Badge>}
                    {stat && stat.n > 0 && (
                      <span
                        className="text-[11px] text-amber-600 font-medium shrink-0"
                        title="Puntuación promedio del equipo con este framework"
                      >
                        <Star className="inline" size={12} strokeWidth={1.75} /> {stat.avgScore.toFixed(1)} · {stat.n}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {f.description}
                  </div>
                </button>
              );
            })}
            <button
              onClick={() => {
                setFrameworkId(null);
                setStep(4);
              }}
              className="rounded-lg border border-dashed border-slate-300 p-4 text-left text-sm text-slate-500 hover:border-brand-blue"
            >
              Dejar que la IA elija la mejor estructura
            </button>
          </div>
          <button className={`${btnSecondary} mt-4`} onClick={() => setStep(2)}>
            <ArrowLeft size={16} strokeWidth={1.75} /> Volver
          </button>
        </Card>
      )}

      {step === 4 && (
        <form
          noValidate
          onSubmit={handleGenerate}
          onChange={(event) => {
            const target = event.nativeEvent.target as HTMLInputElement;
            if (target.name && fieldErrors[target.name]) {
              setFieldErrors((current) => {
                const next = { ...current };
                delete next[target.name];
                return next;
              });
            }
            saveDraft(event.currentTarget);
          }}
          className="space-y-6"
        >
          {Object.keys(fieldErrors).length > 0 && (
            <InlineAlert tone="danger">
              <div className="font-semibold">Revisá los campos marcados antes de generar.</div>
              <ul className="mt-1 list-disc pl-5">
                {Object.values(fieldErrors).map((message) => <li key={message}>{message}</li>)}
              </ul>
            </InlineAlert>
          )}
          <Card className="p-6 space-y-4" key={autofillKey}>
            <div className="flex items-center justify-between">
              <div><h2 className="font-semibold text-brand-navy">Brief del guion</h2><button type="button" className="mt-1 text-xs font-medium text-brand-blue hover:underline" onClick={() => setStep(3)}>{frameworkId ? "Cambiar estructura" : "Elegir estructura manualmente (opcional)"}</button></div>
              <Button
                type="button"
                variant="secondary"
                onClick={handleAutofill}
                loading={autofilling}
                loadingLabel="Leyendo documentos…"
                title="La IA lee los documentos del cliente y pre-llena el brief"
                icon={<Zap size={16} strokeWidth={1.75} />}
              >
                Pre-llenar con IA
              </Button>
            </div>
            {autofillError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-800">
                {autofillError}
              </div>
            )}
            {autofill && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-2 text-xs text-brand-navy">
                <Zap className="mr-1 inline" size={14} strokeWidth={1.75} /> Brief pre-llenado desde los documentos del cliente — revisá y
                corregí antes de generar.
              </div>
            )}
            <div>
              <label htmlFor="script-title" className="block text-xs font-semibold text-slate-600 mb-1">
                Título interno del guion *
              </label>
              <input
                id="script-title"
                name="title"
                className={inputCls}
                placeholder="Ej: VSL lanzamiento curso — enero"
                defaultValue={autofill?.title ?? ""}
                aria-invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? "error-title" : undefined}
              />
              {fieldErrors.title && <p id="error-title" className="mt-1 text-xs text-rose-600">{fieldErrors.title}</p>}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="brief-producto" className="block text-xs font-semibold text-slate-600 mb-1">
                  Producto / servicio *
                </label>
                <textarea id="brief-producto" name="producto" rows={2} className={inputCls} defaultValue={autofill?.producto ?? ""} aria-invalid={Boolean(fieldErrors.producto)} aria-describedby={fieldErrors.producto ? "error-producto" : undefined} />
                {fieldErrors.producto && <p id="error-producto" className="mt-1 text-xs text-rose-600">{fieldErrors.producto}</p>}
              </div>
              <div>
                <label htmlFor="brief-audiencia" className="block text-xs font-semibold text-slate-600 mb-1">
                  Audiencia / avatar *
                </label>
                <textarea id="brief-audiencia" name="audiencia" rows={2} className={inputCls} defaultValue={autofill?.audiencia ?? ""} aria-invalid={Boolean(fieldErrors.audiencia)} aria-describedby={fieldErrors.audiencia ? "error-audiencia" : undefined} />
                {fieldErrors.audiencia && <p id="error-audiencia" className="mt-1 text-xs text-rose-600">{fieldErrors.audiencia}</p>}
              </div>
              <div>
                <label htmlFor="brief-oferta" className="block text-xs font-semibold text-slate-600 mb-1">
                  Oferta (precio, bonos, garantía) *
                </label>
                <textarea id="brief-oferta" name="oferta" rows={2} className={inputCls} defaultValue={autofill?.oferta ?? ""} aria-invalid={Boolean(fieldErrors.oferta)} aria-describedby={fieldErrors.oferta ? "error-oferta" : undefined} />
                {fieldErrors.oferta && <p id="error-oferta" className="mt-1 text-xs text-rose-600">{fieldErrors.oferta}</p>}
              </div>
              <div>
                <label htmlFor="brief-dolores" className="block text-xs font-semibold text-slate-600 mb-1">
                  Dolores principales *
                </label>
                <textarea id="brief-dolores" name="dolores" rows={2} className={inputCls} defaultValue={autofill?.dolores ?? ""} aria-invalid={Boolean(fieldErrors.dolores)} aria-describedby={fieldErrors.dolores ? "error-dolores" : undefined} />
                {fieldErrors.dolores && <p id="error-dolores" className="mt-1 text-xs text-rose-600">{fieldErrors.dolores}</p>}
              </div>
              <div>
                <label htmlFor="brief-objeciones" className="block text-xs font-semibold text-slate-600 mb-1">
                  Objeciones a manejar
                </label>
                <textarea id="brief-objeciones" name="objeciones" rows={2} className={inputCls} defaultValue={autofill?.objeciones ?? ""} />
              </div>
              <div>
                <label htmlFor="brief-cta" className="block text-xs font-semibold text-slate-600 mb-1">
                  CTA (llamado a la acción) *
                </label>
                <input id="brief-cta" name="cta" className={inputCls} defaultValue={autofill?.cta ?? ""} aria-invalid={Boolean(fieldErrors.cta)} aria-describedby={fieldErrors.cta ? "error-cta" : undefined} />
                {fieldErrors.cta && <p id="error-cta" className="mt-1 text-xs text-rose-600">{fieldErrors.cta}</p>}
              </div>
              {format === "reel" ? (
                <>
                  <div>
                    <label htmlFor="brief-duracion-seg" className="block text-xs font-semibold text-slate-600 mb-1">
                      Duración objetivo (segundos)
                    </label>
                    <input
                      id="brief-duracion-seg"
                      name="duracionSeg"
                      type="number"
                      defaultValue={autofill?.duracionSeg ?? 45}
                      min={15}
                      max={90}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label htmlFor="brief-plataforma" className="block text-xs font-semibold text-slate-600 mb-1">
                      Plataforma (opcional)
                    </label>
                    <select id="brief-plataforma" name="plataforma" className={inputCls} defaultValue="">
                      <option value="">Cualquiera</option>
                      <option value="tiktok">TikTok</option>
                      <option value="reels">Instagram Reels</option>
                      <option value="shorts">YouTube Shorts</option>
                    </select>
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="brief-duracion-min" className="block text-xs font-semibold text-slate-600 mb-1">
                    Duración objetivo (minutos)
                  </label>
                  <input
                    id="brief-duracion-min"
                    name="duracionMin"
                    type="number"
                    defaultValue={autofill?.duracionMin ?? 10}
                    min={1}
                    max={60}
                    className={inputCls}
                  />
                </div>
              )}
              <div>
                <label htmlFor="brief-tono" className="block text-xs font-semibold text-slate-600 mb-1">
                  Tono
                </label>
                <input
                  id="brief-tono"
                  name="tono"
                  className={inputCls}
                  placeholder="Ej: directo y emocional, cercano, autoridad"
                  defaultValue={autofill?.tono ?? ""}
                />
              </div>
            </div>
            <div>
              <label htmlFor="brief-instrucciones" className="block text-xs font-semibold text-slate-600 mb-1">
                Instrucciones adicionales
              </label>
              <textarea id="brief-instrucciones" name="instruccionesExtra" rows={2} className={inputCls} defaultValue={autofill?.instruccionesExtra ?? ""} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-brand-navy">Proveedor de esta generación</h2>
            {preflightError ? (
              <div className="mt-3">
                <InlineAlert tone="danger">{preflightError}</InlineAlert>
                <button type="button" className={`${btnSecondary} mt-3`} onClick={() => {
                  setPreflight(null);
                  setPreflightError(null);
                  fetchJson<Preflight>("/api/generation-preflight").then(setPreflight).catch((cause) => setPreflightError((cause as Error).message));
                }}>Reintentar verificación</button>
              </div>
            ) : preflight ? (
              <div className="mt-3 space-y-2 text-sm text-slate-600">
                <div><strong>{preflight.providerLabel}</strong> · <span className="font-mono text-xs">{preflight.model}</span></div>
                {preflight.provider === "openrouter" && preflight.quota && (
                  <div>{preflight.callsPerRun} llamadas por generación · {preflight.quota.remaining} de {preflight.quota.limit} disponibles hoy</div>
                )}
                {!preflight.available && <InlineAlert tone="danger">Este proveedor no está disponible. Configurá su clave/modelo o elegí otro en Configuración.</InlineAlert>}
                {!preflight.setup.hasSystemPrompt && <InlineAlert tone="danger">Falta el prompt maestro; configurarlo es obligatorio antes de generar.</InlineAlert>}
              </div>
            ) : <p className="mt-3 text-sm text-slate-400">Verificando provider y modelo…</p>}
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
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-2 rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-brand-navy sm:grid-cols-4">
                  <span><strong>{selectedSummary.total}</strong> documentos</span>
                  <span><strong>{selectedSummary.radar}</strong> radar</span>
                  <span><strong>{selectedSummary.transcripts}</strong> transcripts</span>
                  <span><strong>{selectedSummary.validated}</strong> ejemplares validados</span>
                </div>
                {documentGroups.map((group) => (
                  <section key={group.key} aria-labelledby={`document-group-${group.key}`}>
                    <h3 id={`document-group-${group.key}`} className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group.label}
                    </h3>
                    <ul className="space-y-2">
                      {group.items.map((doc) => (
                        <li key={doc.id}>
                          <label className={`flex cursor-pointer flex-wrap items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${selectedDocs.has(doc.id) ? "border-blue-200 bg-blue-50/40" : "border-slate-200 bg-white"}`}>
                            <input
                              type="checkbox"
                              checked={selectedDocs.has(doc.id)}
                              onChange={() => toggleDoc(doc.id)}
                              className="accent-brand-blue"
                            />
                            <Badge tone={KIND_TONES[doc.kind] ?? "gray"}>
                              {KIND_LABELS[doc.kind] ?? doc.kind}
                            </Badge>
                            <span className="min-w-48 flex-1">{doc.title}</span>
                            {doc.qualityConflict && <Badge tone="red">Señales en conflicto</Badge>}
                            {!doc.qualityConflict && doc.bestMetric && (
                              <Badge tone="green">Validado por mercado · hook {doc.bestMetric.hookRate.toFixed(1)}%</Badge>
                            )}
                            {doc.avgRating != null && (
                              <span
                                className={`text-[11px] font-medium ${doc.avgRating >= 3 ? "text-amber-600" : "text-rose-500"}`}
                                title={doc.avgRating >= 3 ? "Recomendado por el equipo" : "No se preselecciona por su puntuación interna"}
                              >
                                <Star className="inline" size={12} strokeWidth={1.75} /> {doc.avgRating.toFixed(1)}
                              </span>
                            )}
                            {doc.clientId === null && <span className="text-[10px] text-slate-400">global</span>}
                            <span className="text-xs text-slate-400">{doc.tokenCount.toLocaleString("es")} tk</span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </Card>

          <div className="flex gap-3">
            <button
              type="button"
              className={btnSecondary}
              onClick={() => setStep(2)}
            >
              <ArrowLeft size={16} strokeWidth={1.75} /> Volver
            </button>
            <Button type="submit" disabled={!preflight?.available || !preflight.setup.hasSystemPrompt} loading={generating} loadingLabel="Preparando…" icon={<Sparkles size={16} strokeWidth={1.75} />}>
              Generar {format === "reel" ? "reel" : "guion"}
            </Button>
          </div>
        </form>
      )}

      {step === 5 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-brand-navy">
              {generating ? "Generando guion…" : error ? "Error" : "¡Listo!"}
            </h2>
            {generating ? (
              <AsyncStatus status={aiStatus} fallback="Los modelos están trabajando" />
            ) : output ? (
              <CopyButton text={output} label="Copiar guion" copiedLabel="Guion copiado" />
            ) : null}
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-800 mb-4">
              {error}
              <button
                className={`${btnSecondary} mt-3 block`}
                onClick={() => setStep(4)}
              >
                <ArrowLeft size={16} strokeWidth={1.75} /> Volver al brief
              </button>
              {recovery && <a className={`${btnSecondary} mt-3 ml-2 inline-flex`} href={`/guiones/${recovery.id}`}>Abrir contenido guardado</a>}
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
      <ConfirmDialog
        open={Boolean(pendingPayload)}
        title="Confirmar generación con OpenRouter"
        message={`El arnés 5+1 reserva ${preflight?.callsPerRun ?? 6} llamadas. Quedan ${preflight?.quota?.remaining ?? 0} llamadas disponibles hoy.`}
        confirmLabel="Reservar y generar"
        confirmDisabled={!openrouterAccepted}
        onClose={() => setPendingPayload(null)}
        onConfirm={() => {
          const payload = pendingPayload;
          setPendingPayload(null);
          if (payload) void startGeneration({ ...payload, openrouterConfirmed: true }, null);
        }}
      >
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={openrouterAccepted} onChange={(event) => setOpenrouterAccepted(event.target.checked)} className="mt-1 accent-brand-blue" />
          <span>Entiendo que esta generación reserva 6 llamadas de OpenRouter.</span>
        </label>
      </ConfirmDialog>
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
