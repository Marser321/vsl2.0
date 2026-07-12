import { Skeleton } from "@/components/ui";

export default function TeleprompterLoading() {
  return <div className="fixed inset-0 z-50 bg-slate-950 p-6" aria-label="Cargando teleprompter"><Skeleton className="h-10 w-full bg-slate-800" /><Skeleton className="mx-auto mt-16 h-[65vh] max-w-4xl bg-slate-800" /></div>;
}
