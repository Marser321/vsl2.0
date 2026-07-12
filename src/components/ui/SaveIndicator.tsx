import { AlertCircle, Check, Cloud } from "lucide-react";
import { Spinner } from "./Spinner";

export function SaveIndicator({ state }: { state: "idle" | "dirty" | "saving" | "saved" | "error" }) {
  const config = {
    idle: { icon: <Cloud size={13} />, label: "Sin cambios", className: "text-slate-400" },
    dirty: { icon: <Cloud size={13} />, label: "Sin guardar · borrador local activo", className: "text-warn" },
    saving: { icon: <Spinner className="h-3.5 w-3.5" />, label: "Guardando…", className: "text-brand-blue" },
    saved: { icon: <Check size={13} />, label: "Guardado", className: "text-ok" },
    error: { icon: <AlertCircle size={13} />, label: "No se pudo guardar", className: "text-danger" },
  }[state];
  return <span className={`inline-flex items-center gap-1 text-[11px] ${config.className}`} role="status" aria-live="polite">{config.icon}{config.label}</span>;
}
