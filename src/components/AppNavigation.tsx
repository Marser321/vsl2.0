"use client";

import Link from "next/link";
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
  { href: "/analizador", label: "Analizar referencias", icon: ScanSearch },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function AppNavigation({
  authEnabled,
  onNavigate,
  pathname,
}: {
  authEnabled: boolean;
  onNavigate?: () => void;
  pathname: string;
}) {
  return (
    <div className="flex h-full flex-col bg-brand-navy text-white">
      <div className="px-5 py-6">
        <div className="flex items-center gap-2">
          <Brandmark size={28} variant="light" />
          <div className="leading-tight">
            <div className="text-sm font-bold">VSL Studio</div>
            <div className="text-[10px] text-blue-200">AD Media Solution</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Navegación principal">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-sky/70 ${active ? "bg-white/15 text-white" : "text-blue-100 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon className="w-4 text-brand-sky" size={17} strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      {authEnabled && (
        <form action="/api/auth/logout" method="post" className="px-4 pb-3">
          <button className="min-h-11 w-full rounded-lg border border-white/15 px-3 py-2 text-left text-xs text-blue-200 hover:bg-white/10">Cerrar sesión</button>
        </form>
      )}
      <div className="px-5 py-4 text-[10px] text-blue-300">Guiones que venden · español neutro</div>
    </div>
  );
}
