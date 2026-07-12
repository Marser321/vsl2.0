"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, EmptyState, PageTitle, Skeleton, btnPrimary } from "@/components/ui";
import { ScrollText, Sparkles } from "lucide-react";

type Row = {
  id: number;
  title: string;
  clientName: string | null;
  status: string;
  outcome: string;
  format?: string;
  provider: string;
  model: string;
  createdAt: string;
};

export default function GuionesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageTitle
        title="Guiones"
        subtitle="Todos los guiones generados, con sus versiones y resultados"
        actions={
          <Link href="/generar" className={btnPrimary}>
            <Sparkles size={16} strokeWidth={1.75} /> Generar guion
          </Link>
        }
      />
      <Card>
        {loading ? (
          <div className="divide-y divide-slate-100">{Array.from({ length: 6 }).map((_, index) => <div className="flex gap-4 px-5 py-4" key={index}><Skeleton className="h-4 flex-1" /><Skeleton className="h-4 w-24" /><Skeleton className="h-5 w-20 rounded-full" /></div>)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={ScrollText} title="Todavía no hay guiones" description="Generá el primero a partir del dossier de un cliente." action={<Link href="/generar" className={btnPrimary}><Sparkles size={16} strokeWidth={1.75} /> Generar guion</Link>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {rows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/guiones/${s.id}`}
                  className="flex items-center gap-3 px-5 py-3.5 text-sm hover:bg-brand-mist"
                >
                  <span className="flex-1 font-medium">{s.title}</span>
                  <span className="text-xs text-slate-500">{s.clientName}</span>
                  {s.format === "reel" && <Badge tone="violet">Reel</Badge>}
                  {s.outcome === "won" && <Badge tone="green">Ganador</Badge>}
                  {s.outcome === "lost" && <Badge tone="red">No convirtió</Badge>}
                  <Badge tone="gray">{s.model}</Badge>
                  <span className="text-xs text-slate-400">
                    {s.createdAt.slice(0, 10)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
