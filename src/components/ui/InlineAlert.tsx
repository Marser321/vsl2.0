import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";

export function InlineAlert({ children, tone = "info" }: { children: ReactNode; tone?: "info" | "success" | "warning" | "danger" }) {
  const config = {
    info: { icon: Info, className: "border-blue-200 bg-blue-50 text-brand-navy" },
    success: { icon: CheckCircle2, className: "border-ok-border bg-ok-subtle text-ok" },
    warning: { icon: AlertTriangle, className: "border-warn-border bg-warn-subtle text-warn" },
    danger: { icon: AlertTriangle, className: "border-danger-border bg-danger-subtle text-danger" },
  }[tone];
  const Icon = config.icon;
  return <div className={`flex items-start gap-2 rounded-lg border px-4 py-3 text-sm ${config.className}`} role={tone === "danger" ? "alert" : "status"}><Icon className="mt-0.5 shrink-0" size={16} /> <div>{children}</div></div>;
}
