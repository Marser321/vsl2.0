import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PageTitle({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-navy">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Badge({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "green" | "red" | "gray" | "yellow";
}) {
  const tones = {
    blue: "bg-blue-50 text-brand-blue border-blue-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red: "bg-rose-50 text-rose-700 border-rose-200",
    gray: "bg-slate-100 text-slate-600 border-slate-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-blue-100";

export const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-brand-navy transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const btnSecondary =
  "inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50";

export const KIND_LABELS: Record<string, string> = {
  winning_script: "Guion ganador",
  brief: "Brief",
  framework: "Framework",
  transcript: "Transcript",
  reference: "Referencia",
  learning: "Aprendizaje",
};

export const KIND_TONES: Record<
  string,
  "blue" | "green" | "red" | "gray" | "yellow"
> = {
  winning_script: "green",
  brief: "blue",
  framework: "yellow",
  transcript: "gray",
  reference: "gray",
  learning: "red",
};
