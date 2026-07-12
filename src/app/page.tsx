import Link from "next/link";
import { getDb } from "@/db";
import { clients, documents, scripts } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { Badge, Card, EmptyState, PageTitle, btnPrimary } from "@/components/ui";
import { isAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { ScrollText, Sparkles } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAdminSession())) redirect("/login");
  const db = getDb();
  const [clientRow, docRow, scriptRow, wonRow] = await Promise.all([
    db
    .select({ n: sql<number>`count(*)` })
    .from(clients)
    .then((rows) => rows[0]),
    db
    .select({ n: sql<number>`count(*)` })
    .from(documents)
    .then((rows) => rows[0]),
    db
    .select({ n: sql<number>`count(*)` })
    .from(scripts)
    .then((rows) => rows[0]),
    db
    .select({ n: sql<number>`count(*)` })
    .from(scripts)
    .where(eq(scripts.outcome, "won"))
    .then((rows) => rows[0]),
  ]);
  const clientCount = Number(clientRow?.n ?? 0);
  const docCount = Number(docRow?.n ?? 0);
  const scriptCount = Number(scriptRow?.n ?? 0);
  const wonCount = Number(wonRow?.n ?? 0);

  const recent = await db
    .select({
      id: scripts.id,
      title: scripts.title,
      outcome: scripts.outcome,
      format: scripts.format,
      createdAt: scripts.createdAt,
      clientName: clients.name,
    })
    .from(scripts)
    .leftJoin(clients, eq(scripts.clientId, clients.id))
    .orderBy(desc(scripts.createdAt))
    .limit(8);

  const stats = [
    { label: "Clientes", value: clientCount, href: "/clientes" },
    { label: "Documentos en biblioteca", value: docCount, href: "/biblioteca" },
    { label: "Guiones generados", value: scriptCount, href: "/guiones" },
    { label: "Guiones ganadores", value: wonCount, href: "/guiones" },
  ];

  return (
    <div>
      <PageTitle
        title="VSL Studio"
        subtitle="Generador de guiones de VSL con ingeniería de contexto"
        actions={
          <Link href="/generar" className={btnPrimary}>
            <Sparkles size={16} strokeWidth={1.75} /> Generar guion
          </Link>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 hover:border-brand-blue transition-colors">
              <div className="text-3xl font-bold text-brand-navy">
                {s.value}
              </div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>

      <h2 className="font-semibold text-brand-navy mb-3">Guiones recientes</h2>
      <Card>
        {recent.length === 0 ? (
          <EmptyState icon={ScrollText} title="Todavía no hay guiones" description="Creá un cliente, subí sus documentos y generá el primero." action={<Link href="/clientes" className={btnPrimary}>Crear cliente</Link>} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/guiones/${s.id}`}
                  className="flex items-center gap-3 px-5 py-3 text-sm hover:bg-brand-mist"
                >
                  <span className="flex-1 font-medium">{s.title}</span>
                  <span className="text-xs text-slate-500">{s.clientName}</span>
                  {s.format === "reel" && <Badge tone="violet">Reel</Badge>}
                  {s.outcome === "won" && <Badge tone="green">Ganador</Badge>}
                  {s.outcome === "lost" && <Badge tone="red">No convirtió</Badge>}
                  <span className="text-xs text-slate-400">
                    {s.createdAt.toISOString().slice(0, 10)}
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
