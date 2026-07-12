import { Card, Skeleton } from "@/components/ui";

export default function ClientesLoading() {
  return <div aria-label="Cargando clientes"><Skeleton className="h-8 w-36" /><Skeleton className="mt-2 h-4 w-72" /><div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, index) => <Card className="p-5" key={index}><Skeleton className="h-5 w-36" /><Skeleton className="mt-3 h-3 w-24" /><Skeleton className="mt-4 h-3 w-full" /></Card>)}</div></div>;
}
