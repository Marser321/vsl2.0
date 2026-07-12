"use client";

import { useEffect, useState } from "react";
import { Button, Card } from "./ui";
import { Star } from "lucide-react";
import { toast } from "sonner";

export type VersionRating = {
  id: number;
  scriptVersionId: number;
  score: number;
  tags: string[];
  notes: string | null;
} | null;

const TAG_LABELS: Record<string, string> = {
  gancho: "Gancho",
  claridad: "Claridad",
  prueba: "Prueba",
  oferta: "Oferta",
  cta: "CTA",
  flujoEmocional: "Flujo emocional",
  tono: "Tono",
  largo: "Largo / duración",
};

export default function RatingWidget({
  scriptId,
  versionId,
  rating,
  onRated,
}: {
  scriptId: number;
  versionId: number;
  rating: VersionRating;
  onRated: () => Promise<void> | void;
}) {
  const [hover, setHover] = useState(0);
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(rating?.score ?? 0);
  const [tags, setTags] = useState<string[]>(rating?.tags ?? []);
  const [notes, setNotes] = useState(rating?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractMsg, setExtractMsg] = useState<string | null>(null);

  // Re-sincronizar al cambiar de versión activa.
  useEffect(() => {
    setScore(rating?.score ?? 0);
    setTags(rating?.tags ?? []);
    setNotes(rating?.notes ?? "");
    setOpen(false);
    setSaved(false);
    setError(null);
    setExtractMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [versionId, rating?.id]);

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  async function save() {
    if (!score) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/scripts/${scriptId}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ versionId, score, tags, notes }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Error al guardar la puntuación");
      toast.error(data.error || "Error al guardar la puntuación");
      return;
    }
    setSaved(true);
    toast.success("Puntuación guardada");
    await onRated();
  }

  async function extractLearnings() {
    setExtracting(true);
    setExtractMsg(null);
    const res = await fetch(`/api/scripts/${scriptId}/learnings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromRating: true }),
    });
    const data = await res.json();
    setExtracting(false);
    if (!res.ok) {
      setExtractMsg(data.error || "No se pudieron extraer aprendizajes");
      toast.error(data.error || "No se pudieron extraer aprendizajes");
      return;
    }
    const n = Array.isArray(data.aprendizajes) ? data.aprendizajes.length : 0;
    setExtractMsg(
      `${n} aprendizaje${n === 1 ? "" : "s"} propuesto${n === 1 ? "" : "s"} — aprobalos en Aprendizajes`
    );
    toast.success("Aprendizajes propuestos");
  }

  const effective = hover || score;

  return (
    <Card className="px-5 py-3 mb-4">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-600">
          Puntuación del equipo (esta versión):
        </span>
        <div className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onMouseEnter={() => setHover(n)}
              onClick={() => {
                setScore(n);
                setOpen(true);
                setSaved(false);
              }}
              className={`text-xl leading-none px-0.5 transition-colors ${
                n <= effective ? "text-amber-400" : "text-slate-300 hover:text-amber-300"
              }`}
              title={`${n}/5`}
            >
              <Star size={22} fill={n <= score ? "currentColor" : "none"} strokeWidth={1.75} />
            </button>
          ))}
        </div>
        {rating && !open && (
          <span className="text-[11px] text-slate-400">
            guardada {rating.score}/5
            {rating.tags.length > 0 && ` · ${rating.tags.map((t) => TAG_LABELS[t] ?? t).join(", ")}`}
          </span>
        )}
        <span className="ml-auto text-[11px] text-slate-400">
          Alimenta la selección de ejemplares y las preferencias del equipo
        </span>
      </div>

      {open && (
        <div className="mt-3 border-t border-slate-100 pt-3 space-y-3">
          <div>
            <div className="text-xs font-semibold text-slate-600 mb-1.5">
              {score <= 3 ? "¿Qué falló?" : "¿Qué funcionó?"} (opcional)
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TAG_LABELS).map(([tag, label]) => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    tags.includes(tag)
                      ? "bg-brand-blue text-white border-brand-blue"
                      : "bg-white text-slate-600 border-slate-300 hover:border-brand-blue"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notas (ej: el gancho era genérico, la oferta quedó enterrada…)"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none"
          />
          {error && <div className="text-xs text-rose-600">{error}</div>}
          {extractMsg && <div className="text-xs text-emerald-700">{extractMsg}</div>}
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={!score} loading={saving} loadingLabel="Guardando…">
              {saved ? "Guardada — actualizar" : "Guardar puntuación"}
            </Button>
            {saved && (score <= 2 || score >= 4) && (
              <button
                className="text-xs text-brand-blue hover:underline"
                onClick={extractLearnings}
                disabled={extracting}
              >
                {extracting
                  ? "Extrayendo…"
                  : score <= 2
                    ? "Extraer anti-patrones de esta puntuación"
                    : "Extraer aprendizajes de esta puntuación"}
              </button>
            )}
            <button
              className="text-xs text-slate-400 hover:text-slate-600 ml-auto"
              onClick={() => setOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
