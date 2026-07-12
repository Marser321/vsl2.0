"use client";

import { createClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Brandmark from "../Brandmark";

type Answers = Record<string, Record<string, unknown>>;
type Asset = { id: string; title: string; kind: string; status: string; error: string | null; sourceUrl: string | null };
type Field = {
  name: string;
  label: string;
  type?: "text" | "email" | "url" | "number" | "textarea" | "select" | "checkbox" | "lines";
  placeholder?: string;
  help?: string;
  options?: Array<[string, string]>;
  required?: boolean;
  rows?: number;
};

const STEPS = [
  { key: "contact", title: "Contacto", subtitle: "Quién completa el relevamiento", fields: [
    { name: "name", label: "Nombre y apellido", required: true },
    { name: "role", label: "Cargo o relación con la marca" },
    { name: "email", label: "Email", type: "email", required: true },
    { name: "phone", label: "Teléfono (opcional)" },
    { name: "consent", label: "Autorizo a AD Media Solution a procesar este material para crear los guiones solicitados.", type: "checkbox", required: true },
  ] as Field[] },
  { key: "brand", title: "Marca", subtitle: "Identidad, historia y forma de comunicar", fields: [
    { name: "name", label: "Nombre de la marca", required: true },
    { name: "website", label: "Sitio web", type: "url", placeholder: "https://…" },
    { name: "socialLinks", label: "Redes sociales", type: "lines", help: "Una URL por línea." },
    { name: "country", label: "País de origen" }, { name: "market", label: "Mercados donde vende" },
    { name: "language", label: "Idioma y variante", placeholder: "Español LATAM" },
    { name: "industry", label: "Rubro", required: true }, { name: "subindustry", label: "Subrubro o especialidad" },
    { name: "story", label: "Historia de la marca", type: "textarea", rows: 5, help: "Cómo nació, qué problema observó y qué la impulsó." },
    { name: "purpose", label: "Propósito", type: "textarea" }, { name: "values", label: "Valores", type: "textarea" },
    { name: "personality", label: "Si la marca fuera una persona, ¿cómo sería?", type: "textarea" },
    { name: "tone", label: "Tono de comunicación", type: "textarea", help: "Ej.: cercano, desafiante, técnico, aspiracional." },
    { name: "preferredExpressions", label: "Palabras o expresiones que suele usar", type: "textarea" },
    { name: "forbiddenExpressions", label: "Palabras, promesas o enfoques que debemos evitar", type: "textarea" },
  ] as Field[] },
  { key: "offer", title: "Producto u oferta", subtitle: "Qué vendemos y por qué debería elegirse", fields: [
    { name: "name", label: "Nombre del producto u oferta", required: true },
    { name: "type", label: "Tipo de oferta", type: "select", required: true, options: [["service", "Servicio"], ["course", "Curso o programa"], ["ecommerce", "Producto físico / ecommerce"], ["saas", "Software / SaaS"], ["local", "Negocio local"], ["other", "Otro"]] },
    { name: "description", label: "¿Qué es y qué transformación entrega?", type: "textarea", rows: 5, required: true },
    { name: "mechanism", label: "Mecanismo o método diferencial", type: "textarea", help: "Por qué funciona cuando otras opciones fallan." },
    { name: "benefits", label: "Beneficios principales", type: "textarea" },
    { name: "differentiators", label: "Diferencias frente a alternativas", type: "textarea" },
    { name: "price", label: "Precio" }, { name: "paymentOptions", label: "Formas de pago o financiación", type: "textarea" },
    { name: "bonuses", label: "Bonos o extras", type: "textarea" }, { name: "guarantee", label: "Garantía", type: "textarea" },
    { name: "delivery", label: "Cómo se entrega o implementa", type: "textarea" },
    { name: "availability", label: "Disponibilidad o capacidad", type: "textarea" },
    { name: "urgency", label: "Urgencia o escasez real", type: "textarea" },
  ] as Field[] },
  { key: "audience", title: "Audiencia", subtitle: "La persona a la que debe hablarle el VSL", fields: [
    { name: "primaryAvatar", label: "Avatar principal", type: "textarea", rows: 5, required: true, help: "Situación, edad aproximada, contexto y momento vital." },
    { name: "secondaryAvatar", label: "Avatar secundario", type: "textarea" },
    { name: "awareness", label: "¿Qué tanto conoce el problema y las soluciones?", type: "textarea" },
    { name: "pains", label: "Dolores y frustraciones", type: "textarea", rows: 5, required: true },
    { name: "desires", label: "Deseos y resultados soñados", type: "textarea", rows: 4 },
    { name: "previousAttempts", label: "Qué intentó antes y por qué no funcionó", type: "textarea" },
    { name: "objections", label: "Objeciones antes de comprar", type: "textarea" },
    { name: "triggers", label: "Qué evento la impulsa a buscar una solución", type: "textarea" },
    { name: "ownLanguage", label: "Frases textuales que usan los clientes", type: "textarea", help: "Mensajes, reseñas o expresiones reales. Esto mejora mucho el copy." },
    { name: "alternatives", label: "Alternativas que considera", type: "textarea" },
    { name: "competitors", label: "Competidores o referentes", type: "textarea" },
  ] as Field[] },
  { key: "proof", title: "Prueba", subtitle: "Razones concretas para creer", fields: [
    { name: "founderStory", label: "Historia del fundador o experto", type: "textarea", rows: 5 },
    { name: "experience", label: "Experiencia y autoridad", type: "textarea" },
    { name: "metrics", label: "Métricas y resultados verificables", type: "textarea" },
    { name: "cases", label: "Casos de éxito", type: "textarea", rows: 5 },
    { name: "testimonials", label: "Testimonios", type: "textarea", rows: 5 },
    { name: "claimSources", label: "Fuentes que respaldan los claims", type: "textarea" },
    { name: "certifications", label: "Certificaciones, premios o alianzas", type: "textarea" },
    { name: "legalRestrictions", label: "Restricciones legales o de plataforma", type: "textarea" },
  ] as Field[] },
  { key: "campaign", title: "Campaña VSL", subtitle: "Objetivo de este guion particular", fields: [
    { name: "title", label: "Nombre interno de la campaña", required: true },
    { name: "objective", label: "Objetivo principal", type: "textarea", required: true },
    { name: "trafficSource", label: "Origen del tráfico", placeholder: "Meta Ads, YouTube, orgánico…" },
    { name: "funnelStage", label: "Etapa del funnel", placeholder: "Tráfico frío, remarketing, cierre…" },
    { name: "durationMinutes", label: "Duración objetivo (minutos)", type: "number" },
    { name: "cta", label: "Llamado a la acción", type: "textarea", required: true },
    { name: "angle", label: "Ángulo o gran idea sugerida", type: "textarea" },
    { name: "format", label: "Formato o referencias de estilo", type: "textarea" },
    { name: "deadline", label: "Fecha límite" },
    { name: "mustInclude", label: "Qué debe incluir sí o sí", type: "textarea" },
    { name: "mustAvoid", label: "Qué debe evitar", type: "textarea" },
  ] as Field[] },
  { key: "materials", title: "Materiales", subtitle: "Archivos, páginas, videos y texto de referencia", fields: [] as Field[] },
  { key: "review", title: "Revisión", subtitle: "Confirmá la información antes de enviarla", fields: [] as Field[] },
] as const;

const CONDITIONAL_FIELDS: Record<string, Field> = {
  service: { name: "serviceProcess", label: "Proceso del servicio", type: "textarea" },
  course: { name: "courseModules", label: "Módulos, metodología y acompañamiento", type: "textarea" },
  ecommerce: { name: "ecommerceSpecs", label: "Materiales, características y logística", type: "textarea" },
  saas: { name: "saasFeatures", label: "Funciones, onboarding e integraciones", type: "textarea" },
  local: { name: "localCoverage", label: "Ubicación, cobertura y atención", type: "textarea" },
};

export default function IntakeWizard({ publicId }: { publicId: string }) {
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState("draft");
  const [answers, setAnswers] = useState<Answers>({});
  const [assets, setAssets] = useState<Asset[]>([]);
  const [revision, setRevision] = useState(0);
  const [completion, setCompletion] = useState(0);
  const [missing, setMissing] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const initialized = useRef(false);
  const revisionRef = useRef(0);
  const savedSections = useRef<Record<string, string>>({});

  const load = useCallback(async () => {
    const response = await fetch(`/api/intakes/public/${publicId}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setFatal(data.error ?? "No se pudo abrir el relevamiento."); setLoading(false); return; }
    setTitle(data.request.title); setStatus(data.request.status); setAnswers(data.submission.answers ?? {});
    setRevision(data.submission.revision); revisionRef.current = data.submission.revision;
    savedSections.current = Object.fromEntries(Object.entries(data.submission.answers ?? {}).map(([key, value]) => [key, JSON.stringify(value)]));
    setCompletion(data.submission.completion); setAssets(data.assets ?? []); setMissing(data.missing ?? []);
    initialized.current = true; setLoading(false);
  }, [publicId]);

  useEffect(() => { load(); }, [load]);

  const current = STEPS[step];
  const editable = status === "draft" || status === "changes_requested";
  const currentData = answers[current?.key] ?? {};

  const saveCurrent = useCallback(async () => {
    if (!initialized.current || !editable || !current || current.key === "materials" || current.key === "review") return true;
    const fingerprint = JSON.stringify(answers[current.key] ?? {});
    if (savedSections.current[current.key] === fingerprint) return true;
    setSaveState("saving");
    const response = await fetch(`/api/intakes/public/${publicId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ section: current.key, data: answers[current.key] ?? {}, revision: revisionRef.current }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 409 && data.answers) { setAnswers(data.answers); setRevision(data.revision); revisionRef.current = data.revision; }
      setSaveState("error"); return false;
    }
    setRevision(data.revision); revisionRef.current = data.revision; savedSections.current[current.key] = fingerprint;
    setCompletion(data.completion); setMissing(data.missing ?? []); setSaveState("saved"); return true;
  }, [answers, current, editable, publicId]);

  useEffect(() => {
    if (!initialized.current || !editable || current.key === "materials" || current.key === "review") return;
    setSaveState("idle");
    const timer = setTimeout(() => { saveCurrent(); }, 900);
    return () => clearTimeout(timer);
  }, [current.key, currentData, editable, saveCurrent]);

  function update(name: string, value: unknown) {
    setAnswers((previous) => ({ ...previous, [current.key]: { ...(previous[current.key] ?? {}), [name]: value } }));
  }

  async function go(next: number) {
    if (!(await saveCurrent())) return;
    setStep(Math.max(0, Math.min(STEPS.length - 1, next)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    if (!(await saveCurrent())) return;
    setSubmitting(true); setSubmitError("");
    const response = await fetch(`/api/intakes/public/${publicId}`, { method: "POST" });
    const data = await response.json(); setSubmitting(false);
    if (!response.ok) return setSubmitError(data.missingRequired ? `Faltan: ${data.missingRequired.join(", ")}.` : data.error);
    setStatus("submitted");
  }

  if (loading) return <PublicFrame><div className="animate-pulse text-slate-500">Cargando relevamiento…</div></PublicFrame>;
  if (fatal) return <PublicFrame><StateMessage title="No se puede abrir este enlace" text={fatal} /></PublicFrame>;
  if (!editable) return <PublicFrame><StateMessage title={status === "approved" ? "Relevamiento aprobado" : "¡Gracias! Ya recibimos todo"} text={status === "in_review" ? "El equipo comenzó la revisión. Si necesita una aclaración, volverá a habilitar este enlace." : status === "approved" ? "El dossier ya forma parte del contexto de tu marca." : "El equipo revisará el material antes de redactar el VSL."} /></PublicFrame>;

  const fields = current.key === "offer"
    ? [...current.fields, ...(CONDITIONAL_FIELDS[String(currentData.type ?? "")] ? [CONDITIONAL_FIELDS[String(currentData.type)]] : [])]
    : [...current.fields];

  return (
    <PublicFrame>
      <header className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-blue">Relevamiento estratégico</p>
        <h1 className="mt-2 text-3xl font-bold text-brand-navy">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Cuanto más específico sea el material, más auténtico y persuasivo será el guion. Podés cerrar y volver con el mismo enlace.</p>
      </header>

      <div className="mb-7 grid grid-cols-4 gap-2 sm:grid-cols-8">
        {STEPS.map((item, index) => <button key={item.key} onClick={() => go(index)} className="text-left" aria-label={`Ir a ${item.title}`}><span className={`block h-1.5 rounded-full ${index <= step ? "bg-brand-blue" : "bg-slate-200"}`} /><span className={`mt-1 hidden text-[10px] sm:block ${index === step ? "font-semibold text-brand-navy" : "text-slate-400"}`}>{item.title}</span></button>)}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><p className="text-xs text-slate-400">Paso {step + 1} de {STEPS.length}</p><h2 className="text-2xl font-bold text-brand-navy">{current.title}</h2><p className="mt-1 text-sm text-slate-500">{current.subtitle}</p></div>
          <span className={`text-xs ${saveState === "error" ? "text-rose-600" : "text-slate-400"}`}>{saveState === "saving" ? "Guardando…" : saveState === "saved" ? "Guardado" : saveState === "error" ? "No se pudo guardar" : `${completion}% completo`}</span>
        </div>

        {current.key === "materials" ? <Materials publicId={publicId} assets={assets} onChange={load} /> : current.key === "review" ? <Review answers={answers} completion={completion} missing={missing} assets={assets} /> : (
          <div className="grid gap-5 sm:grid-cols-2">{fields.map((field) => <FieldInput key={field.name} field={field} value={currentData[field.name]} onChange={(value) => update(field.name, value)} />)}</div>
        )}

        {submitError && <p className="mt-5 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700" aria-live="polite">{submitError}</p>}
        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-5">
          <button onClick={() => go(step - 1)} disabled={step === 0} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 disabled:invisible"><ArrowLeft size={16} strokeWidth={1.75} />Anterior</button>
          {step < STEPS.length - 1 ? <button onClick={() => go(step + 1)} className="inline-flex items-center gap-2 rounded-lg bg-brand-blue px-5 py-2.5 text-sm font-semibold text-white">Continuar <ArrowRight size={16} strokeWidth={1.75} /></button> : <button onClick={submit} disabled={submitting} className="rounded-lg bg-brand-navy px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{submitting ? "Enviando y organizando…" : "Enviar relevamiento"}</button>}
        </div>
      </section>
    </PublicFrame>
  );
}

function FieldInput({ field, value, onChange }: { field: Field; value: unknown; onChange: (value: unknown) => void }) {
  const cls = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-brand-blue focus:ring-2 focus:ring-blue-100";
  if (field.type === "checkbox") return <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4"><input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="mt-1 accent-[#488eff]" /><span className="text-sm text-slate-700">{field.label}{field.required && " *"}</span></label>;
  const display = Array.isArray(value) ? value.join("\n") : value == null ? "" : String(value);
  return <label className={(field.type === "textarea" || field.type === "lines") ? "sm:col-span-2" : ""}><span className="mb-1 block text-xs font-semibold text-slate-600">{field.label}{field.required && " *"}</span>{field.type === "textarea" || field.type === "lines" ? <textarea rows={field.rows ?? 3} className={cls} value={display} placeholder={field.placeholder} onChange={(e) => onChange(field.type === "lines" ? e.target.value.split("\n").map((line) => line.trim()).filter(Boolean) : e.target.value)} /> : field.type === "select" ? <select className={cls} value={display} onChange={(e) => onChange(e.target.value)}><option value="">Elegí una opción</option>{field.options?.map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select> : <input className={cls} type={field.type ?? "text"} value={display} placeholder={field.placeholder} min={field.type === "number" ? 1 : undefined} max={field.type === "number" ? 60 : undefined} onChange={(e) => onChange(field.type === "number" ? Number(e.target.value) : e.target.value)} />}{field.help && <span className="mt-1 block text-xs leading-5 text-slate-400">{field.help}</span>}</label>;
}

function Materials({ publicId, assets, onChange }: { publicId: string; assets: Asset[]; onChange: () => Promise<void> }) {
  const [url, setUrl] = useState(""); const [urlTitle, setUrlTitle] = useState("");
  const [text, setText] = useState(""); const [textTitle, setTextTitle] = useState("");
  const [busy, setBusy] = useState(""); const [error, setError] = useState("");

  async function addSource(payload: unknown, label: string) {
    setBusy(label); setError("");
    const response = await fetch(`/api/intakes/public/${publicId}/assets`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json(); setBusy("");
    if (!response.ok) return setError(data.error);
    setUrl(""); setUrlTitle(""); setText(""); setTextTitle(""); await onChange();
  }

  async function upload(file: File) {
    setBusy(file.name); setError("");
    const response = await fetch(`/api/intakes/public/${publicId}/assets/upload`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ filename: file.name, mimeType: file.type || "text/plain", sizeBytes: file.size }) });
    const data = await response.json();
    if (!response.ok) { setBusy(""); return setError(data.error); }
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const uploaded = await supabase.storage.from("intake-assets").uploadToSignedUrl(data.path, data.token, file, { contentType: file.type });
    if (uploaded.error) { setBusy(""); return setError(uploaded.error.message); }
    await fetch(`/api/intakes/public/${publicId}/assets/${data.asset.id}/process`, { method: "POST" });
    setBusy(""); await onChange();
  }

  return <div className="space-y-6"><div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5"><h3 className="font-semibold text-brand-navy">Subir imágenes o documentos</h3><p className="mt-1 text-xs text-slate-500">JPG, PNG o WebP hasta 10 MB. PDF, DOCX, TXT o MD hasta 25 MB.</p><input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.txt,.md" className="mt-4 block text-sm" disabled={Boolean(busy)} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></div><div className="grid gap-5 sm:grid-cols-2"><div><h3 className="font-semibold text-brand-navy">Agregar enlace</h3><input className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={urlTitle} onChange={(e) => setUrlTitle(e.target.value)} placeholder="Título: Instagram, video, landing…" /><input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /><button disabled={!url || !urlTitle || Boolean(busy)} onClick={() => addSource({ kind: /youtu|vimeo/i.test(url) ? "video_url" : "url", title: urlTitle, url }, urlTitle)} className="mt-2 rounded-lg border border-brand-blue px-3 py-2 text-xs font-semibold text-brand-blue disabled:opacity-40">Analizar enlace</button></div><div><h3 className="font-semibold text-brand-navy">Pegar texto</h3><input className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={textTitle} onChange={(e) => setTextTitle(e.target.value)} placeholder="Título del material" /><textarea className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Transcript, reseñas, mensajes…" /><button disabled={!text || !textTitle || Boolean(busy)} onClick={() => addSource({ kind: "text", title: textTitle, text }, textTitle)} className="mt-2 rounded-lg border border-brand-blue px-3 py-2 text-xs font-semibold text-brand-blue disabled:opacity-40">Guardar texto</button></div></div>{busy && <p className="text-sm text-brand-blue animate-pulse">Procesando {busy}…</p>}{error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<AssetList assets={assets} /></div>;
}

function AssetList({ assets }: { assets: Asset[] }) {
  const tones: Record<string, string> = { ready: "bg-emerald-50 text-emerald-700", needs_input: "bg-amber-50 text-amber-700", failed: "bg-rose-50 text-rose-700", processing: "bg-blue-50 text-blue-700", queued: "bg-slate-100 text-slate-600" };
  if (!assets.length) return <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">Todavía no agregaste materiales.</p>;
  return <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">{assets.map((asset) => <li key={asset.id} className="p-4"><div className="flex items-center gap-3"><span className="flex-1 text-sm font-medium text-slate-700">{asset.title}</span><span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${tones[asset.status] ?? tones.queued}`}>{asset.status === "needs_input" ? "requiere información" : asset.status}</span></div>{asset.error && <p className="mt-2 text-xs text-amber-700">{asset.error}</p>}</li>)}</ul>;
}

function Review({ answers, completion, missing, assets }: { answers: Answers; completion: number; missing: string[]; assets: Asset[] }) {
  return <div className="space-y-5"><div className="rounded-xl bg-brand-mist p-5"><div className="flex items-center justify-between"><span className="font-semibold text-brand-navy">Completitud del contexto</span><strong className="text-2xl text-brand-blue">{completion}%</strong></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white"><div className="h-full bg-brand-blue" style={{ width: `${completion}%` }} /></div></div>{missing.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="text-sm font-semibold text-amber-900">Información opcional que mejoraría el guion</h3><p className="mt-1 text-xs text-amber-800">{missing.join(" · ")}</p></div>}<div className="grid gap-3 sm:grid-cols-2">{Object.entries(answers).map(([section, data]) => <div key={section} className="rounded-xl border border-slate-200 p-4"><h3 className="text-sm font-semibold capitalize text-brand-navy">{section}</h3><p className="mt-2 line-clamp-6 whitespace-pre-wrap text-xs leading-5 text-slate-600">{Object.entries(data).filter(([, value]) => value !== "" && value !== false && (!Array.isArray(value) || value.length)).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join("\n") || "Sin respuestas"}</p></div>)}</div><p className="text-sm text-slate-500">Materiales agregados: <strong>{assets.length}</strong>. Al enviar, el equipo revisará todo antes de generar el VSL.</p></div>;
}

function PublicFrame({ children }: { children: React.ReactNode }) { return <div className="min-h-screen bg-brand-mist px-4 py-8 sm:px-8"><div className="mx-auto max-w-4xl"><div className="mb-8 flex items-center gap-2"><Brandmark size={28} /><span className="text-sm font-semibold text-brand-navy">VSL Studio</span></div>{children}<footer className="py-8 text-center text-xs text-slate-400">La información se utiliza únicamente para preparar la estrategia y los guiones solicitados.</footer></div></div>; }
function StateMessage({ title, text }: { title: string; text: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-blue-50 text-brand-blue"><Check size={22} strokeWidth={1.75} /></div><h1 className="text-2xl font-bold text-brand-navy">{title}</h1><p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">{text}</p></div>; }
