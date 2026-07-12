import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: ReactNode;
  description?: ReactNode;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <Icon size={40} strokeWidth={1.5} className="mb-4 text-slate-300" />
      <h2 className="text-sm font-semibold text-brand-navy">{title}</h2>
      {description && <div className="mt-1 max-w-md text-sm leading-6 text-slate-500">{description}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
