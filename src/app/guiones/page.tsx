"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge, Card, PageTitle, btnPrimary } from "@/components/ui";
import { Sparkles } from "lucide-react";

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

  useEffect(() => {
    fetch("/api/scripts")
      .then((r) => r.json())
      .then(setRows);
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
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-400">
            Todavía no hay guiones.
          </div>
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
