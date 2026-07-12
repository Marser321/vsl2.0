import type { TableHTMLAttributes } from "react";

export function Table({ className = "", ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      <table
        className={`w-full text-sm [&_thead]:border-b [&_thead]:border-slate-200 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wide [&_th]:text-slate-500 [&_tbody_tr]:border-t [&_tbody_tr]:border-slate-100 [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-slate-50/70 [&_td]:px-3 [&_td]:py-2.5 ${className}`}
        {...props}
      />
    </div>
  );
}
