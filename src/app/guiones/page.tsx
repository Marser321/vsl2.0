"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, EmptyState, InlineAlert, PageTitle, Skeleton, btnPrimary } from "@/components/ui";
import { ScrollText, Sparkles } from "lucide-react";
import { fetchJson } from "@/lib/http/fetch-json";

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
  generationError?: string | null;
};

export default function GuionesPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setRows(await fetchJson<Row[]>("/api/scripts"));
    } catch (cause) {
      setLoadError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

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
      {loadError && <div className="mb-4"><InlineAlert tone="danger">{loadError}</InlineAlert><Button className="mt-3" onClick={() => void load()}>Reintentar</Button></div>}
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
                  className="flex flex-wrap items-center gap-2 px-4 py-3.5 text-sm hover:bg-brand-mist sm:gap-3 sm:px-5"
                >
                  <span className="min-w-48 flex-1 font-medium">{s.title}</span>
                  <span className="text-xs text-slate-500">{s.clientName}</span>
                  {s.format === "reel" && <Badge tone="violet">Reel</Badge>}
                  {s.outcome === "won" && <Badge tone="green">Ganador</Badge>}
                  {s.outcome === "lost" && <Badge tone="red">No convirtió</Badge>}
                  {s.status === "generating" && <Badge tone="blue">Generando</Badge>}
                  {s.status === "failed" && <Badge tone="red">Falló · parcial guardado</Badge>}
                  {s.status === "interrupted" && <Badge tone="yellow">Interrumpido</Badge>}
                  <span className="hidden sm:inline-flex"><Badge tone="gray">{s.model}</Badge></span>
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
