"use client";

import { usePathname } from "next/navigation";
import { useRef } from "react";
import { Menu, X } from "lucide-react";
import Brandmark from "./Brandmark";
import { AppNavigation } from "./AppNavigation";

export default function AppShell({
  children,
  authEnabled = false,
}: {
  children: React.ReactNode;
  authEnabled?: boolean;
}) {
  const pathname = usePathname();
  const mobileNavRef = useRef<HTMLDialogElement>(null);
  const isPublic = pathname === "/login" || pathname.startsWith("/relevamiento/");
  if (isPublic) return <main className="min-h-screen">{children}</main>;

  return (
    <div className="flex min-h-screen">
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between bg-brand-navy px-4 text-white shadow-md lg:hidden">
        <div className="flex items-center gap-2"><Brandmark size={26} variant="light" /><span className="text-sm font-bold">VSL Studio</span></div>
        <button className="grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-brand-sky" onClick={() => mobileNavRef.current?.showModal()} aria-label="Abrir navegación">
          <Menu size={22} />
        </button>
      </header>
      <dialog ref={mobileNavRef} className="m-0 h-dvh w-72 max-w-[85vw] p-0 shadow-2xl backdrop:bg-slate-950/50 lg:hidden">
        <button className="absolute right-3 top-3 z-10 grid min-h-11 min-w-11 place-items-center rounded-lg text-blue-100 hover:bg-white/10" onClick={() => mobileNavRef.current?.close()} aria-label="Cerrar navegación"><X size={20} /></button>
        <AppNavigation pathname={pathname} authEnabled={authEnabled} onNavigate={() => mobileNavRef.current?.close()} />
      </dialog>
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 lg:block">
        <AppNavigation pathname={pathname} authEnabled={authEnabled} />
      </aside>
      <main className="min-w-0 flex-1 px-4 pb-6 pt-20 sm:px-6 lg:p-8">{children}</main>
    </div>
  );
}
