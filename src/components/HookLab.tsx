"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, CopyButton } from "./ui";
import { FlaskConical, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type HookVariant = { angulo: string; texto: string };
type HookSet = { id: number; hooks: HookVariant[]; createdAt: string };

export default function HookLab({ scriptId }: { scriptId: number }) {
  const [sets, setSets] = useState<HookSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/scripts/${scriptId}/hooks`);
    if (res.ok) setSets(await res.json());
  }, [scriptId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/scripts/${scriptId}/hooks`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Error al generar ganchos");
      toast.error(data.error || "Error al generar ganchos");
      return;
    }
    toast.success("10 ganchos listos para testear");
    await load();
  }

  const latest = sets[0];

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-brand-navy text-sm">
          <FlaskConical className="mr-2 inline" size={16} strokeWidth={1.75} /> Hook Lab — variantes A/B del gancho
        </h3>
        <Button variant="secondary" onClick={generate} loading={loading} loadingLabel="Generando 10 ganchos…" icon={latest ? <RefreshCw size={15} strokeWidth={1.75} /> : undefined}>
          {latest ? "Regenerar" : "Generar 10 ganchos"}
        </Button>
      </div>
      <p className="text-xs text-slate-500 mb-3">
        Diez aperturas con ángulos distintos para testear en ads. Reusa el
        contexto cacheado del cliente — cuesta centavos.
      </p>
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200 px-4 py-2 text-sm text-rose-800 mb-3">
          {error}
        </div>
      )}
      {latest && (
        <ul className="space-y-2">
          {latest.hooks.map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 text-sm hover:border-brand-blue group"
            >
              <Badge tone="blue">{h.angulo}</Badge>
              <span className="flex-1 leading-relaxed">{h.texto}</span>
              <CopyButton
                text={h.texto}
                className="shrink-0"
                copiedLabel="Copiado"
                variant="ghost"
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
