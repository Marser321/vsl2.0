import { Card, Skeleton } from "@/components/ui";

export default function ScriptDetailLoading() {
  return <div aria-label="Cargando guion"><Skeleton className="h-8 w-72 max-w-full" /><Skeleton className="mt-2 h-4 w-52 max-w-full" /><div className="mt-6 flex gap-2"><Skeleton className="h-9 w-20 rounded-full" /><Skeleton className="h-9 w-20 rounded-full" /></div><Card className="mt-5 p-6"><Skeleton className="h-5 w-44" /><Skeleton className="mt-5 h-[50vh] w-full" /></Card></div>;
}
