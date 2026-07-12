import { Card, Skeleton } from "@/components/ui";

export default function RelevamientosLoading() {
  return <div aria-label="Cargando relevamientos"><Skeleton className="h-8 w-52" /><Skeleton className="mt-2 h-4 w-80" /><Card className="mt-6 divide-y divide-slate-100">{Array.from({ length: 5 }).map((_, index) => <div className="flex gap-4 px-5 py-4" key={index}><div className="flex-1"><Skeleton className="h-4 w-52" /><Skeleton className="mt-2 h-3 w-32" /></div><Skeleton className="h-5 w-20 rounded-full" /><Skeleton className="h-4 w-20" /></div>)}</Card></div>;
}
