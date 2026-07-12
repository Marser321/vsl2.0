"use client";

import { useState } from "react";
import { Button, Card } from "./ui";
import { BookOpen, Check } from "lucide-react";
import { toast } from "sonner";

export default function LearningsPanel({
  scriptId,
  outcome,
}: {
  scriptId: number;
  outcome: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [learnings, setLearnings] = useState<string[] | null>(null);

  async function extract() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/scripts/${scriptId}/learnings`, {
      method: "POST",
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al extraer aprendizajes");
      toast.error(data.error || "Error al extraer aprendizajes");
      return;
    }
    setLearnings(data.aprendizajes);
    toast.success("Aprendizajes enviados a revisión");
  }

  if (outcome === "unknown") return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-brand-navy text-sm">
          <BookOpen className="mr-2 inline" size={16} strokeWidth={1.75} /> Playbook de aprendizajes
        </h3>
        <Button variant="secondary" onClick={extract} loading={loading} loadingLabel="Analizando el caso…">Extraer aprendizajes</Button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Este guion tiene resultado conocido (
        {outcome === "won" ? "ganó" : "no convirtió"}). Extraé por qué y sumalo
        a la cola de aprendizajes anonimizados del rubro. Solo entra al contexto
        después de una aprobación humana.
      </p>
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-800">
          {error}
        </div>
      )}
      {learnings && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4">
          <div className="text-xs font-semibold text-emerald-800 mb-2">
            <Check className="mr-1 inline" size={14} strokeWidth={1.75} /> Extraído y pendiente de aprobación:
          </div>
          <ul className="space-y-1.5">
            {learnings.map((l, i) => (
              <li key={i} className="text-sm text-emerald-900 flex gap-2">
                <span className="shrink-0">•</span>
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
