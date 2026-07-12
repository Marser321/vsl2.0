"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  ClipboardList,
  Home,
  LayoutTemplate,
  Library,
  ScanSearch,
  ScrollText,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Brandmark from "./Brandmark";

const NAV = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/relevamientos", label: "Relevamientos", icon: ClipboardList },
  { href: "/generar", label: "Generar guion", icon: Sparkles },
  { href: "/plantillas", label: "Plantillas", icon: LayoutTemplate },
  { href: "/guiones", label: "Guiones", icon: ScrollText },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/biblioteca", label: "Biblioteca", icon: Library },
  { href: "/aprendizajes", label: "Aprendizajes", icon: Brain },
  { href: "/analizador", label: "Analizador de VSLs", icon: ScanSearch },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export default function AppShell({
  children,
  authEnabled = false,
}: {
  children: React.ReactNode;
  authEnabled?: boolean;
}) {
  const pathname = usePathname();
  const isPublic = pathname === "/login" || pathname.startsWith("/relevamiento/");
  if (isPublic) return <main className="min-h-screen">{children}</main>;

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 bg-brand-navy text-white flex flex-col">
        <div className="px-5 py-6">
          <div className="flex items-center gap-2">
            <Brandmark size={28} variant="light" />
            <div className="leading-tight">
              <div className="font-bold text-sm">VSL Studio</div>
              <div className="text-[10px] text-blue-200">AD Media Solution</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/70 ${pathname === item.href ? "bg-white/15 text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="w-4 text-brand-sky" size={17} strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        {authEnabled && (
          <form action="/api/auth/logout" method="post" className="px-4 pb-3">
            <button className="w-full rounded-lg border border-white/15 px-3 py-2 text-left text-xs text-blue-200 hover:bg-white/10">Cerrar sesión</button>
          </form>
        )}
        <div className="px-5 py-4 text-[10px] text-blue-300">Guiones que venden · es-LATAM</div>
      </aside>
      <main className="flex-1 min-w-0 p-8">{children}</main>
    </div>
  );
}
