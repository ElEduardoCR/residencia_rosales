"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef } from "react";
import Icon, { type IconName } from "@/components/Icon";
import ThemeToggle from "@/components/ThemeToggle";

const NAV: { href: string; label: string; icon: IconName; adminOnly?: boolean }[] = [
  { href: "/", label: "Inicio", icon: "home" },
  { href: "/agenda", label: "Agenda por hora", icon: "clock" },
  { href: "/pacientes", label: "Pacientes", icon: "patients" },
  { href: "/actividades", label: "Registro diario", icon: "clipboard" },
  { href: "/salidas", label: "Registro de salida", icon: "exit" },
  { href: "/visitas", label: "Visitas", icon: "visits" },
  { href: "/menu", label: "Menú semanal", icon: "menu" },
  { href: "/personal", label: "Personal", icon: "staff", adminOnly: true },
];

export default function Sidebar({ nombre, esAdmin, accesoLocal, usuario }: { nombre: string; esAdmin: boolean; accesoLocal: boolean; usuario: string }) {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const iniciales = nombre.split(/\s+/).slice(0, 2).map((n) => n[0]).join("").toUpperCase();
  const cerrar = () => dialog.current?.close();

  function contenido(movil = false) {
    return <>
      <div className="flex items-center gap-3 px-5 pb-7 pt-6">
        <div className="brand-mark"><Icon name="heart" width="23" height="23" /></div>
        <div className="min-w-0 leading-tight">
          <div className="text-[11px] font-medium tracking-[.14em] text-slate-500">RESIDENCIA</div>
          <div className="mt-0.5 text-xl font-semibold tracking-tight text-slate-900">Rosales</div>
        </div>
        {movil && <button onClick={cerrar} className="btn btn-ghost ml-auto px-2.5" aria-label="Cerrar menú"><Icon name="close" /></button>}
      </div>
      <nav aria-label="Navegación principal" className="min-h-0 flex-1 overflow-y-auto px-3">
        <p className="eyebrow mb-3 px-3.5 text-[10px]">EL DÍA A DÍA</p>
        <div className="flex flex-col gap-1.5">
          {NAV.filter((item) => esAdmin || !item.adminOnly).map((item) => {
            const activo = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(item.href + "/");
            return <Link key={item.href} href={item.href} onClick={cerrar} aria-current={activo ? "page" : undefined} className="nav-link"><Icon name={item.icon} /><span>{item.label}</span>{activo && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-current" />}</Link>;
          })}
        </div>
      </nav>
      <div className="m-3 mt-8 rounded-2xl border border-slate-200 p-3">
        <ThemeToggle className="mb-3 w-full justify-start" />
        <div className="mb-3 flex items-center gap-2.5">
          <div aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-marca-100 text-xs font-semibold text-marca-800">{iniciales}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-800" title={nombre}>{nombre}</div>
            <div className="text-xs text-slate-500">{accesoLocal ? "Acceso local" : esAdmin ? "Administración" : "Enfermería"}</div>
          </div>
        </div>
        {accesoLocal ? <p className="border-t border-slate-200 pt-3 text-xs leading-relaxed text-slate-500">Sin inicio de sesión · En este equipo</p> : <>
          <div className="mb-3 truncate text-xs text-slate-500" title={usuario}>Usuario: {usuario}</div>
          <form action="/auth/signout" method="post"><button type="submit" className="btn btn-ghost w-full justify-start border-t border-slate-200 text-xs"><Icon name="exit" width="17" height="17" />Cerrar sesión</button></form>
        </>}
      </div>
    </>;
  }

  return <>
    <header className="app-navigation glass sticky top-0 z-30 flex items-center justify-between px-4 py-3 md:hidden">
      <div><Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-900"><Icon name="heart" className="text-marca-700" />Residencia Rosales</Link>{accesoLocal && <p className="mt-1 pl-[30px] text-xs text-slate-500">Acceso local</p>}</div>
      <button onClick={() => dialog.current?.showModal()} className="btn btn-ghost px-3" aria-label="Abrir menú"><Icon name="bars" /></button>
    </header>
    <aside className="app-navigation glass fixed inset-y-4 left-4 z-40 hidden w-64 flex-col rounded-[28px] md:flex">{contenido()}</aside>
    <dialog ref={dialog} className="app-navigation mobile-navigation glass" aria-label="Menú de navegación" onClick={(e) => { if (e.target === dialog.current) cerrar(); }}>
      <div className="flex h-full flex-col">{contenido(true)}</div>
    </dialog>
  </>;
}
