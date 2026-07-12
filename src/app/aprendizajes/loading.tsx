import { Card, Skeleton } from "@/components/ui";

export default function AprendizajesLoading() {
  return <div aria-label="Cargando aprendizajes"><Skeleton className="h-8 w-64" /><Skeleton className="mt-2 h-4 w-96 max-w-full" /><Card className="mt-6 p-5"><Skeleton className="h-5 w-56" /><div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-2"><Skeleton className="h-36" /><Skeleton className="h-36" /></div></Card><Card className="mt-6 p-5"><Skeleton className="h-5 w-64" /><Skeleton className="mt-3 h-12 w-full" /></Card></div>;
}
