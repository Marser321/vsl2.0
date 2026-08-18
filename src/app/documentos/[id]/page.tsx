import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/auth/session";
import DocumentoDetalle from "@/components/DocumentoDetalle";

export const dynamic = "force-dynamic";

export default async function DocumentoPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminSession())) redirect("/login");
  const { id } = await params;
  return <DocumentoDetalle id={Number(id)} />;
}
