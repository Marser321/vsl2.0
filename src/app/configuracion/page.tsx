"use client";

import { useEffect, useState } from "react";
import { Badge, Card, PageTitle, btnPrimary, inputCls } from "@/components/ui";
import { Check } from "lucide-react";

type Settings = Record<string, unknown> & {
  anthropic_key_set?: boolean;
  openai_key_set?: boolean;
  openrouter_key_set?: boolean;
  openrouter_quota?: { used: number; remaining: number; limit: number; day: string };
};

export default function ConfiguracionPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const fd = new FormData(e.currentTarget);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        default_provider: fd.get("default_provider"),
        default_model_anthropic: String(fd.get("default_model_anthropic") ?? ""),
        default_model_openai: String(fd.get("default_model_openai") ?? ""),
        default_model_openrouter: "openrouter/ensemble-5+1",
        system_prompt: String(fd.get("system_prompt") ?? ""),
        wpm_es: String(fd.get("wpm_es") ?? ""),
        context_token_budget: String(fd.get("context_token_budget") ?? ""),
      }),
    });
    setSaving(false);
    setSaved(true);
  }

  if (!settings)
    return <div className="text-sm text-slate-400">Cargando…</div>;

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
          <div className="flex items-center gap-2">
            Anthropic (Claude):{" "}
            {settings.anthropic_key_set ? (
              <Badge tone="green">configurada</Badge>
            ) : (
              <Badge tone="red">falta</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            OpenAI:{" "}
            {settings.openai_key_set ? (
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
          servidor (<code>OPENROUTER_API_KEYS</code>, <code>ANTHROPIC_API_KEY</code> y <code>OPENAI_API_KEY</code>)
          y requieren reiniciar la app.
        </p>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-brand-navy text-sm">Modelos</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Proveedor por defecto
              </label>
              <select
                name="default_provider"
                defaultValue={String(settings.default_provider ?? "openrouter")}
                className={inputCls}
              >
                <option value="openrouter">OpenRouter — arnés gratuito 5+1</option>
                <option value="anthropic">Claude (Anthropic)</option>
                <option value="openai">OpenAI</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Modelo Claude
              </label>
              <input
                name="default_model_anthropic"
                defaultValue={String(settings.default_model_anthropic ?? "")}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">
                Modelo OpenAI
              </label>
              <input
                name="default_model_openai"
                defaultValue={String(settings.default_model_openai ?? "")}
                className={inputCls}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          <button className={btnPrimary} disabled={saving}>
            {saving ? "Guardando…" : "Guardar configuración"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-600"><Check size={15} strokeWidth={1.75} /> Guardado</span>
          )}
        </div>
      </form>
    </div>
  );
}
