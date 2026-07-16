"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, InlineAlert, PageTitle, Skeleton, inputCls } from "@/components/ui";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { fetchJson } from "@/lib/http/fetch-json";

type Settings = Record<string, unknown> & {
  openrouter_key_set?: boolean;
  openrouter_quota?: { used: number; remaining: number; limit: number; day: string };
};

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      setSettings(await fetchJson<Settings>("/api/settings"));
    } catch (cause) {
      setLoadError((cause as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    const response = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        default_provider: "openrouter",
        default_model_openrouter: "openrouter/ensemble-5+1",
        system_prompt: String(fd.get("system_prompt") ?? ""),
        wpm_es: String(fd.get("wpm_es") ?? ""),
        context_token_budget: String(fd.get("context_token_budget") ?? ""),
      }),
    });
    if (!response.ok) {
      const data = await response.json();
      toast.error(data.error || "No se pudo guardar la configuración");
      setSaving(false);
      return;
    }
    setSaving(false);
    setSaved(true);
    toast.success("Configuración guardada");
  }

  if (!settings && loadError)
    return <Card className="max-w-3xl p-6"><InlineAlert tone="danger">{loadError}</InlineAlert><Button className="mt-4" onClick={() => void load()}>Reintentar</Button></Card>;

  if (!settings)
    return <div className="max-w-3xl" aria-label="Cargando configuración"><Skeleton className="h-8 w-48" /><Skeleton className="mt-2 h-4 w-80" /><Card className="mt-6 p-5"><Skeleton className="h-5 w-32" /><Skeleton className="mt-4 h-9 w-full" /></Card><Card className="mt-6 p-5"><Skeleton className="h-5 w-40" /><Skeleton className="mt-4 h-64 w-full" /></Card></div>;

  return (
    <div className="max-w-3xl">
      <PageTitle
        title="Configuración"
        subtitle="Modelos, prompt maestro y parámetros de generación"
      />

      <Card className="p-5 mb-6">
        <h2 className="font-semibold text-brand-navy text-sm mb-3">
          Claves de API
        </h2>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            OpenRouter 5+1:{" "}
            {settings.openrouter_key_set ? (
              <Badge tone="green">configurada</Badge>
            ) : (
              <Badge tone="red">falta</Badge>
            )}
          </div>
        </div>
        {settings.openrouter_quota && (
          <p className="text-xs text-slate-600 mt-3">
            Cuota OpenRouter: <strong>{settings.openrouter_quota.used}</strong> usadas ·{" "}
            <strong>{settings.openrouter_quota.remaining}</strong> restantes de {settings.openrouter_quota.limit}
          </p>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Las claves se configuran en el archivo <code>.env.local</code> del
          servidor (<code>OPENROUTER_API_KEYS</code>)
          y requieren reiniciar la app.
        </p>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-brand-navy text-sm">Modelos</h2>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Proveedor
            </label>
            <p className="text-sm text-slate-700">OpenRouter — arnés gratuito 5+1</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Palabras por minuto (español, para duración)
              </label>
              <input
                name="wpm_es"
                type="number"
                defaultValue={String(settings.wpm_es ?? "150")}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Presupuesto de tokens de contexto
              </label>
              <input
                name="context_token_budget"
                type="number"
                defaultValue={String(settings.context_token_budget ?? "150000")}
                className={inputCls}
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold text-brand-navy text-sm mb-1">
            Prompt maestro
          </h2>
          <p className="text-xs text-slate-500 mb-3">
            El rol y estándar de calidad del copywriter. Iteralo acá — cada
            cambio aplica a las próximas generaciones sin tocar código.
          </p>
          <textarea
            name="system_prompt"
            rows={22}
            defaultValue={String(settings.system_prompt ?? "")}
            className={`${inputCls} font-mono text-xs leading-relaxed`}
          />
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" loading={saving} loadingLabel="Guardando…">Guardar configuración</Button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check size={15} strokeWidth={1.75} /> Guardado</span>
          )}
        </div>
      </form>
    </div>
  );
}
