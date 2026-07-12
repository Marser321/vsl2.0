import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Badge({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "red" | "gray" | "yellow" | "violet" }) {
  const tones = {
    blue: "border-blue-200 bg-blue-50 text-brand-blue",
    green: "border-ok-border bg-ok-subtle text-ok",
    red: "border-danger-border bg-danger-subtle text-danger",
    gray: "border-slate-200 bg-slate-100 text-slate-600",
    yellow: "border-warn-border bg-warn-subtle text-warn",
    violet: "border-violet-200 bg-violet-50 text-violet-700",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}>{children}</span>;
}

export const KIND_LABELS: Record<string, string> = {
  winning_script: "Guion ganador",
  brief: "Brief",
  framework: "Framework",
  transcript: "Transcript",
  reference: "Referencia",
  learning: "Aprendizaje",
};

export const KIND_TONES: Record<string, "blue" | "green" | "red" | "gray" | "yellow"> = {
  winning_script: "green",
  brief: "blue",
  framework: "yellow",
  transcript: "gray",
  reference: "gray",
  learning: "red",
};

export const FORMAT_LABELS: Record<string, string> = { vsl: "VSL", reel: "Reel" };
export const FORMAT_TONES: Record<string, "blue" | "violet"> = { vsl: "blue", reel: "violet" };
