import { Card, Skeleton } from "@/components/ui";

export default function DashboardLoading() {
  return (
    <div aria-label="Cargando dashboard">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Card className="p-5" key={index}><Skeleton className="h-9 w-16" /><Skeleton className="mt-2 h-3 w-28" /></Card>)}
      </div>
      <Skeleton className="mb-3 mt-8 h-5 w-36" />
      <Card className="divide-y divide-slate-100">
        {Array.from({ length: 5 }).map((_, index) => <div className="flex items-center gap-4 px-5 py-4" key={index}><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-16 rounded-full" /></div>)}
      </Card>
    </div>
  );
}
