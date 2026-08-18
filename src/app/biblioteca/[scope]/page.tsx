import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { getDb } from "@/db";
import { documents } from "@/db/schema";
import { isAdminSession } from "@/lib/auth/session";
import { PageTitle } from "@/components/ui";
import DocumentManager from "@/components/DocumentManager";
import { industryLabel } from "@/lib/industry";

export const dynamic = "force-dynamic";

export default async function SeccionBibliotecaPage({
  params,
}: {
  params: Promise<{ scope: string }>;
}) {
  if (!(await isAdminSession())) redirect("/login");
  const { scope } = await params;

  if (scope === "agencia") {
    return (
      <div>
        <Volver />
        <PageTitle
          title="Doctrina de la agencia"
          subtitle="Frameworks, reglas de oro y aprendizajes propios. Los de tipo Framework y Aprendizaje entran SIEMPRE al contexto de generación, para todos los clientes."
        />
        <DocumentManager scope="agencia" />
      </div>
    );
  }

  // El slug del rubro tiene que existir en la biblioteca; si no, 404.
  const db = getDb();
  const [vertical] = await db
    .select({ industry: sql<string>`min(${documents.industry})`, n: sql<number>`count(*)::int` })
    .from(documents)
    .where(and(eq(documents.visibility, "industry"), eq(documents.industrySlug, scope)))
    .groupBy(documents.industrySlug);

  if (!vertical) notFound();

  const nombre = vertical.industry || industryLabel(scope);

  return (
    <div>
      <Volver />
      <PageTitle
        title={nombre}
        subtitle={`${vertical.n} documentos del rubro. Entran al contexto de los clientes de esta industria — no de los demás, así que no subas acá nada que identifique a un cliente puntual.`}
      />
      <DocumentManager scope={`industria:${scope}`} industria={nombre} />
    </div>
  );
}

function Volver() {
  return (
    <Link
      href="/biblioteca"
      className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-blue"
    >
      <ArrowLeft size={15} strokeWidth={1.75} /> Biblioteca
    </Link>
  );
}
