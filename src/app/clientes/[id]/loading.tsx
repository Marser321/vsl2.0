import { Card, Skeleton } from "@/components/ui";

export default function ClientDetailLoading() {
  return <div aria-label="Cargando cliente"><Skeleton className="h-8 w-56" /><Skeleton className="mt-2 h-4 w-32" /><div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-2"><Card className="p-5"><Skeleton className="h-5 w-36" /><Skeleton className="mt-5 h-40 w-full" /></Card><Card className="p-5"><Skeleton className="h-5 w-28" /><Skeleton className="mt-5 h-40 w-full" /></Card></div></div>;
}
