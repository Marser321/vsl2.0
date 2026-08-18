import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { BookMarked, Library } from "lucide-react";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { isAdminSession } from "@/lib/auth/session";
import { Card, EmptyState, PageTitle } from "@/components/ui";
import { industryLabel } from "@/lib/industry";

export const dynamic = "force-dynamic";

export default async function BibliotecaPage() {
  if (!(await isAdminSession())) redirect("/login");
  const db = getDb();

  const [[agencia], verticales] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(documents)
      .where(and(isNull(documents.clientId), eq(documents.visibility, "global"))),
    db
      .select({
        slug: documents.industrySlug,
        industry: sql<string>`min(${documents.industry})`,
        n: sql<number>`count(*)::int`,
      })
      .from(documents)
      .where(and(eq(documents.visibility, "industry"), sql`${documents.industrySlug} is not null`))
      .groupBy(documents.industrySlug)
      .orderBy(documents.industrySlug),
  ]);

  return (
    <div>
      <PageTitle
        title="Biblioteca"
        subtitle="El material que alimenta cada generación. La doctrina de la agencia entra en todos los guiones; la de un rubro, solo en los de ese rubro."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/biblioteca/agencia">
          <Card className="h-full p-5 transition-colors hover:border-brand-blue">
            <div className="flex items-center gap-2 font-semibold text-brand-navy">
              <BookMarked size={18} strokeWidth={1.75} /> Doctrina de la agencia
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Frameworks, reglas de oro y aprendizajes propios. Entran al contexto de todos los
              clientes.
            </p>
            <div className="mt-3 text-2xl font-bold text-brand-navy">{agencia?.n ?? 0}</div>
          </Card>
        </Link>

        {verticales.map((v) => (
          <Link key={v.slug} href={`/biblioteca/${v.slug}`}>
            <Card className="h-full p-5 transition-colors hover:border-brand-blue">
              <div className="flex items-center gap-2 font-semibold text-brand-navy">
                <Library size={18} strokeWidth={1.75} />{" "}
                {v.industry || industryLabel(v.slug ?? "")}
              </div>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Guiones y referencias del rubro. Entran solo en las generaciones de clientes de esta
                industria.
              </p>
              <div className="mt-3 text-2xl font-bold text-brand-navy">{v.n}</div>
            </Card>
          </Link>
        ))}
      </div>

      {verticales.length === 0 && (
        <Card className="mt-4">
          <EmptyState
            icon={Library}
            title="Todavía no hay bibliotecas por rubro"
            description="Importá los guiones de un vertical con «npm run corpus:import» y van a aparecer acá, separados de la doctrina general."
          />
        </Card>
      )}

      <p className="mt-6 text-xs text-slate-500">
        Los documentos privados de cada cliente viven en su ficha, dentro de{" "}
        <Link href="/clientes" className="text-brand-blue hover:underline">
          Clientes
        </Link>
        .
      </p>
    </div>
  );
}
