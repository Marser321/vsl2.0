import { CheckCircle2 } from "lucide-react";
import { Spinner } from "./Spinner";

export type ProcessStatus = {
  stage: string;
  completed?: number;
  total?: number;
};

export function AsyncStatus({
  complete = false,
  fallback = "Procesando…",
  status,
}: {
  complete?: boolean;
  fallback?: string;
  status: ProcessStatus | null;
}) {
  const hasProgress = status?.total && status.total > 0 && status.completed !== undefined;
  const progress = hasProgress ? Math.min(100, Math.round((status.completed! / status.total!) * 100)) : null;
  return (
    <div className="min-w-48" role="status" aria-live="polite" aria-atomic="true">
      <div className={`flex items-center gap-2 text-xs font-medium ${complete ? "text-ok" : "text-brand-blue"}`}>
        {complete ? <CheckCircle2 size={15} /> : <Spinner />}
        <span>{status?.stage || fallback}</span>
        {hasProgress && <span className="text-slate-400">{status.completed}/{status.total}</span>}
      </div>
      {progress !== null && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-blue-100" aria-hidden="true">
          <div className="h-full rounded-full bg-brand-blue transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
