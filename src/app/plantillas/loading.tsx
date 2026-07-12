import { Card, Skeleton } from "@/components/ui";

export default function PlantillasLoading() {
  return <div aria-label="Cargando plantillas"><Skeleton className="h-8 w-40" /><Skeleton className="mt-2 h-4 w-96 max-w-full" /><Skeleton className="mb-3 mt-6 h-5 w-20" /><div className="grid grid-cols-1 gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, index) => <Card className="p-5" key={index}><Skeleton className="h-5 w-2/3" /><Skeleton className="mt-3 h-3 w-full" /><Skeleton className="mt-5 h-9 w-full" /></Card>)}</div></div>;
}
