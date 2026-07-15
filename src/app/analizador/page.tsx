"use client";

import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ScriptMarkdown from "@/components/ScriptMarkdown";
import { AsyncStatus, Button, Card, CopyButton, InlineAlert, PageTitle, inputCls, type ProcessStatus } from "@/components/ui";
import { Check, FileAudio, Microscope, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

type Client = { id: number; name: string };
type TranscriptionReadiness = {
  available: boolean;
  provider: "openrouter" | "groq" | "none";
  model: string;
  error: string | null;
};
type StreamEvent = {
  type: "status" | "transcript" | "delta" | "done" | "error";
  stage?: string;
  completed?: number;
  total?: number;
  text?: string;
  title?: string;
  documentId?: number;
  message?: string;
  uploadFallback?: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  validando: "Validando la fuente",
  obteniendo_subtitulos: "Buscando subtítulos públicos",
  descargando_audio: "Descargando el audio público",
  transcribiendo: "Transcribiendo el audio",
  analizando: "Analizando la ingeniería persuasiva",
  guardando: "Guardando en la biblioteca",
};

async function consumeSse(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "No se pudo iniciar el análisis");
  }
  if (!response.body) throw new Error("El servidor no inició el stream");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split("\n\n");
    buffer = events.pop() ?? "";
    for (const raw of events) {
      if (!raw.startsWith("data: ")) continue;
      const event = JSON.parse(raw.slice(6)) as StreamEvent;
      onEvent(event);
      if (event.type === "error") throw new Error(event.message || "El análisis falló");
    }
  }
}

export default function AnalizadorPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [clientId, setClientId] = useState("");
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [transcript, setTranscript] = useState("");
  const [output, setOutput] = useState("");
  const [savedDocId, setSavedDocId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadSuggested, setUploadSuggested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState<ProcessStatus | null>(null);
  const [transcriptionReadiness, setTranscriptionReadiness] = useState<TranscriptionReadiness | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/clients")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("No se pudieron cargar los clientes")))
      .then(setClients)
      .catch((cause) => setError((cause as Error).message));
    fetch("/api/readiness")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("No se pudo verificar la transcripción")))
      .then((data) => setTranscriptionReadiness(data.transcription))
      .catch(() => setTranscriptionReadiness(null));
  }, []);

  function resetRun() {
    setBusy(true);
    setOutput("");
    setSavedDocId(null);
    setError(null);
    setUploadSuggested(false);
    setAiStatus({ stage: "Preparando la referencia" });
  }

  async function createUpload(file: File) {
    const response = await fetch("/api/analyze/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, mimeType: file.type, sizeBytes: file.size }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "No se pudo preparar el upload");
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const uploaded = await supabase.storage.from(data.bucket).uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });
    if (uploaded.error) throw new Error(uploaded.error.message);
    return data.path as string;
  }

  async function handleSocialImport() {
    resetRun();
    try {
      const storagePath = sourceFile ? await createUpload(sourceFile) : undefined;
      const response = await fetch("/api/analyze/import-social", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(storagePath ? { storagePath } : { url: sourceUrl.trim() }),
          title: title.trim() || undefined,
          clientId: clientId ? Number(clientId) : null,
        }),
      });
      await consumeSse(response, (event) => {
        if (event.type === "status") {
          setAiStatus({ stage: STAGE_LABELS[event.stage || ""] || event.stage || "Procesando", completed: event.completed, total: event.total });
        } else if (event.type === "transcript") {
          setTranscript(event.text || "");
          if (!title.trim() && event.title) setTitle(event.title);
        } else if (event.type === "delta") {
          setOutput((current) => current + (event.text || ""));
          outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight });
        } else if (event.type === "done") {
          setSavedDocId(event.documentId || null);
          toast.success("Referencia analizada y guardada");
        } else if (event.type === "error") {
          setUploadSuggested(Boolean(event.uploadFallback));
        }
      });
    } catch (cause) {
      setError((cause as Error).message);
      if (!sourceFile) setUploadSuggested(true);
    } finally {
      setBusy(false);
    }
  }

  async function handleManualAnalyze(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    resetRun();
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, transcript, clientId: clientId ? Number(clientId) : null }),
      });
      await consumeSse(response, (streamEvent) => {
        if (streamEvent.type === "status") setAiStatus({ stage: streamEvent.stage || "Analizando", completed: streamEvent.completed, total: streamEvent.total });
        if (streamEvent.type === "delta") setOutput((current) => current + (streamEvent.text || ""));
        if (streamEvent.type === "done") setSavedDocId(streamEvent.documentId || null);
      });
      toast.success("Análisis guardado en la biblioteca");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const generateHref = `/generar?${new URLSearchParams({
    ...(clientId ? { clientId } : {}),
    ...(savedDocId ? { documentId: String(savedDocId) } : {}),
  }).toString()}`;

  return (
    <div className="max-w-4xl">
      <PageTitle title="Analizador de referencias" subtitle="Pegá una URL pública de YouTube, Instagram o TikTok. VSL Studio obtiene el transcript, extrae la ingeniería persuasiva y lo guarda como contexto reutilizable." />

      <Card className="mb-6 p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-brand-blue"><Sparkles size={20} /></div>
          <div><h2 className="font-semibold text-brand-navy">Importar y analizar</h2><p className="mt-1 text-xs leading-5 text-slate-500">Solo contenido público de hasta 7 minutos. Primero buscamos subtítulos; si no existen, procesamos el audio sin depender de OpenAI.</p></div>
        </div>
        {transcriptionReadiness && <div className={`mb-5 rounded-lg border px-3 py-2 text-xs ${transcriptionReadiness.available ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}><strong>{transcriptionReadiness.available ? "Audio listo" : "Audio pendiente"}:</strong> {transcriptionReadiness.available ? `${transcriptionReadiness.provider === "groq" ? "Groq" : "OpenRouter"} · ${transcriptionReadiness.model}` : transcriptionReadiness.error}</div>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label><span className="mb-1 block text-xs font-semibold text-slate-600">Título opcional</span><input value={title} onChange={(event) => setTitle(event.target.value)} className={inputCls} placeholder="Se completa desde el video" /></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-600">Cliente opcional</span><select value={clientId} onChange={(event) => setClientId(event.target.value)} className={inputCls}><option value="">Biblioteca global</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
        </div>
        <label className="mt-4 block"><span className="mb-1 block text-xs font-semibold text-slate-600">URL social</span><input type="url" value={sourceUrl} onChange={(event) => { setSourceUrl(event.target.value); setSourceFile(null); }} className={inputCls} placeholder="https://youtube.com/… · instagram.com/… · tiktok.com/…" /></label>
        <div className="my-4 flex items-center gap-3 text-[11px] uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />o subí el archivo<span className="h-px flex-1 bg-slate-200" /></div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 p-4 hover:border-brand-blue">
          <Upload size={18} className="text-brand-blue" /><span className="flex-1 text-sm text-slate-600">{sourceFile ? sourceFile.name : "MP3, M4A, WAV, MP4 o WebM · máximo 7 min / 100 MB"}</span>
          <input type="file" className="sr-only" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/webm,video/mp4,video/webm" onChange={(event) => { setSourceFile(event.target.files?.[0] || null); setSourceUrl(""); }} />
        </label>
        <Button className="mt-5" onClick={handleSocialImport} disabled={!sourceUrl.trim() && !sourceFile} loading={busy} loadingLabel={aiStatus?.stage || "Procesando…"} icon={<Microscope size={16} />}>Importar y analizar</Button>
      </Card>

      {error && <InlineAlert tone="danger"><strong>No pudimos completar la importación.</strong><p className="mt-1">{error}</p>{uploadSuggested && !sourceFile && <p className="mt-2 font-medium">Descargá el video desde una fuente autorizada y subilo en el recuadro anterior.</p>}</InlineAlert>}

      <details className="my-6 rounded-xl border border-slate-200 bg-white">
        <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-brand-navy">¿Ya tenés el transcript? Pegalo manualmente</summary>
        <form onSubmit={handleManualAnalyze} className="space-y-4 border-t border-slate-100 p-5">
          <label><span className="mb-1 block text-xs font-semibold text-slate-600">Título *</span><input required value={title} onChange={(event) => setTitle(event.target.value)} className={inputCls} /></label>
          <label><span className="mb-1 block text-xs font-semibold text-slate-600">Transcript *</span><textarea required minLength={100} rows={10} value={transcript} onChange={(event) => setTranscript(event.target.value)} className={inputCls} /></label>
          <Button type="submit" loading={busy} icon={<FileAudio size={16} />}>Analizar transcript</Button>
        </form>
      </details>

      {(output || busy) && <Card className="p-6"><div className="mb-4 flex flex-wrap items-center gap-3"><h2 className="flex-1 font-semibold text-brand-navy">Análisis estructural</h2>{busy ? <AsyncStatus status={aiStatus} fallback="Procesando referencia" /> : output ? <CopyButton text={output} label="Copiar análisis" copiedLabel="Análisis copiado" /> : null}</div><div ref={outputRef} className="max-h-[65vh] overflow-y-auto"><ScriptMarkdown content={output || "…"} /></div></Card>}

      {savedDocId && <Card className="mt-6 border-emerald-200 bg-emerald-50 p-5"><div className="flex flex-wrap items-center gap-3"><Check className="text-emerald-600" size={20} /><div className="min-w-56 flex-1"><h2 className="font-semibold text-emerald-900">Referencia lista para usar</h2><p className="mt-1 text-xs text-emerald-700">El transcript y su análisis quedaron guardados en la biblioteca.</p></div><Link href={generateHref} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-95"><Sparkles size={16} />Usar en un nuevo guion</Link></div></Card>}
    </div>
  );
}
