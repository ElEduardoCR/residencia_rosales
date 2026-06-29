"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/pacientes", label: "Pacientes", icon: "👴" },
  { href: "/actividades", label: "Actividades", icon: "📋" },
  { href: "/inventario", label: "Inventario", icon: "💊" },
  { href: "/visitas", label: "Visitas y salidas", icon: "🚪" },
  { href: "/menu", label: "Menú semanal", icon: "🍽️" },
  { href: "/personal", label: "Personal", icon: "🩺" },
];

function esActivo(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);

  const Enlaces = (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => {
        const activo = esActivo(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setAbierto(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
              activo
                ? "bg-marca-700 text-white"
                : "text-slate-700 hover:bg-marca-50 hover:text-marca-800",
            )}
          >
            <span className="text-lg leading-none">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <span>🌹</span> Residencia Rosales
        </div>
        <button
          onClick={() => setAbierto(true)}
          className="btn btn-ghost px-2 py-1"
          aria-label="Abrir menú"
        >
          ☰
        </button>
      </header>

      {/* Overlay móvil */}
      {abierto && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setAbierto(false)}
        />
      )}

      {/* Barra lateral */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform md:translate-x-0",
          abierto ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-marca-700 text-lg">
            🌹
          </div>
          <div className="leading-tight">
            <div className="font-bold text-slate-900">Residencia</div>
            <div className="text-xs text-marca-700">Rosales</div>
          </div>
          <button
            onClick={() => setAbierto(false)}
            className="ml-auto text-slate-400 md:hidden"
            aria-label="Cerrar menú"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">{Enlaces}</div>

        <div className="border-t border-slate-200 p-3">
          <div className="mb-2 truncate px-2 text-xs text-slate-500" title={email}>
            {email}
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn btn-secondary w-full text-sm">
              Cerrar sesión
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
