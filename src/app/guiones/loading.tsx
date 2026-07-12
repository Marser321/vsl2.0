import { Card, Skeleton } from "@/components/ui";

export default function GuionesLoading() {
  return <div aria-label="Cargando guiones"><Skeleton className="h-8 w-36" /><Skeleton className="mt-2 h-4 w-80" /><Card className="mt-6 divide-y divide-slate-100">{Array.from({ length: 6 }).map((_, index) => <div className="flex gap-4 px-5 py-4" key={index}><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-20 rounded-full" /></div>)}</Card></div>;
}
