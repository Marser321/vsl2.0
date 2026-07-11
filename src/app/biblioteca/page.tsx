import DocumentManager from "@/components/DocumentManager";
import { PageTitle } from "@/components/ui";
import { isAdminSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";

export default async function BibliotecaPage() {
  if (!(await isAdminSession())) redirect("/login");
  return (
    <div>
      <PageTitle
        title="Biblioteca global"
        subtitle="Frameworks, transcripts de VSLs famosos, guiones ganadores y aprendizajes de la agencia — disponibles para todos los clientes. Los documentos de tipo Framework y Aprendizaje entran SIEMPRE al contexto de generación."
      />
      <DocumentManager scope="global" />
    </div>
  );
}
