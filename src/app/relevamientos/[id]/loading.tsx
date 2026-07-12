import { Card, Skeleton } from "@/components/ui";

export default function IntakeDetailLoading() {
  return <div aria-label="Cargando relevamiento"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="mt-2 h-4 w-40" /><Card className="mt-6 p-5"><Skeleton className="h-48 w-full" /></Card></div>;
}
