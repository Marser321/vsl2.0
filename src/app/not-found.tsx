import Link from "next/link";
import Brandmark from "@/components/Brandmark";
import { btnPrimary } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="text-center">
        <Brandmark size={44} />
        <h1 className="mt-6 text-2xl font-bold text-brand-navy">Esta página no existe</h1>
        <p className="mt-2 text-sm text-slate-500">El enlace puede haber cambiado o estar incompleto.</p>
        <Link href="/" className={`${btnPrimary} mt-6`}>Volver al dashboard</Link>
      </div>
    </div>
  );
}
