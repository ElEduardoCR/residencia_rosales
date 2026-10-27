"use client";

import { useState } from "react";
import Link from "next/link";
import { formatFecha, iniciales } from "@/lib/utils";
import type { Salida } from "@/lib/types";
import { leerDatosSalida } from "@/lib/salidas";
import SalidaForm from "./SalidaForm";

type SalidaConPaciente = Salida & { pacientes?: { nombre: string } | null };

export default function SalidasCliente({ salidas, pacientes, personal, pacienteInicial = "", errorCarga }: {
  salidas: SalidaConPaciente[];
  pacientes: { id: string; nombre: string; tutor_nombre?: string | null; tutor_parentesco?: string | null }[];
  personal: { id: string; nombre: string }[];
  pacienteInicial?: string;
  errorCarga?: string;
}) {
  const [mostrar, setMostrar] = useState(!!pacienteInicial);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const abiertos = salidas.filter((s) => s.estado === "fuera");
  const idsFuera = new Set(abiertos.map((s) => s.paciente_id));
  const disponibles = pacientes.filter((p) => !idsFuera.has(p.id));
  const texto = busqueda.trim().toLocaleLowerCase();
  const lista = salidas.filter((s) => (estado === "todos" || s.estado === estado) && (!desde || s.fecha_salida >= desde) && (!hasta || s.fecha_salida <= hasta) && `${s.pacientes?.nombre ?? ""} ${s.quien_lo_lleva} ${leerDatosSalida(s.notas).destino}`.toLocaleLowerCase().includes(texto));

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-wrap gap-2"><span className="badge bg-marca-100 text-marca-800">{abiertos.length} fuera de la residencia</span><span className="badge bg-slate-100 text-slate-700">{salidas.length} registros</span></div>
      <button className={mostrar ? "btn btn-secondary" : "btn btn-primary"} disabled={!!errorCarga} onClick={() => setMostrar(!mostrar)}>{mostrar ? "Cerrar formulario" : "+ Registrar salida"}</button>
    </div>
    {errorCarga && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorCarga}</p>}
    {mostrar && (disponibles.length === 0 ? <div className="card p-6 text-sm text-slate-600">No hay residentes disponibles para salir. Agrega un paciente o registra primero su regreso.</div> : <SalidaForm pacientes={disponibles} personal={personal} pacienteInicial={pacienteInicial} onCancelar={() => setMostrar(false)} onCreada={() => setMostrar(false)} />)}
    <section aria-label="Historial de salidas" className="space-y-4">
      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label><span className="label">Buscar</span><input type="search" className="input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Residente, familiar o destino" /></label>
        <label><span className="label">Estado</span><select className="input" value={estado} onChange={(e) => setEstado(e.target.value)}><option value="todos">Todas las salidas</option><option value="fuera">Fuera de la residencia</option><option value="regresado">Con regreso registrado</option></select></label>
        <label><span className="label">Desde</span><input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} /></label>
        <label><span className="label">Hasta</span><input type="date" className="input" min={desde} value={hasta} onChange={(e) => setHasta(e.target.value)} /></label>
      </div>
      <p className="text-sm text-slate-500" aria-live="polite">{lista.length} registro(s) encontrado(s)</p>
      {!lista.length && !errorCarga ? <div className="card p-10 text-center"><h2 className="font-semibold text-slate-800">{salidas.length ? "Sin coincidencias" : "Aún no hay salidas registradas"}</h2><p className="mt-2 text-sm text-slate-500">{salidas.length ? "Prueba otro nombre, estado o intervalo de fechas." : "Cada registro conserva el inventario, las condiciones y las firmas de salida y regreso."}</p></div> : <div className="space-y-3">{lista.map((salida) => <Link key={salida.id} href={`/salidas/${salida.id}`} className="card flex flex-wrap items-center gap-4 p-5 transition hover:border-marca-300"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-marca-100 text-sm font-semibold text-marca-800" aria-hidden="true">{iniciales(salida.pacientes?.nombre ?? "Residente")}</div><div className="min-w-0 flex-1"><h3 className="font-semibold text-slate-900">{salida.pacientes?.nombre ?? "Residente"}</h3><p className="mt-1 text-sm text-slate-500">{formatFecha(salida.fecha_salida)} {salida.hora_salida?.slice(0, 5)} · {salida.quien_lo_lleva}</p>{leerDatosSalida(salida.notas).destino && <p className="mt-1 text-sm text-slate-600">{leerDatosSalida(salida.notas).destino}</p>}</div><div className="text-right"><span className={`badge ${salida.estado === "fuera" ? "bg-marca-100 text-marca-800" : "bg-emerald-100 text-emerald-800"}`}>{salida.estado === "fuera" ? "Fuera" : "Regresó"}</span><span className="mt-2 block text-xs text-slate-500">{salida.fecha_regreso ? formatFecha(salida.fecha_regreso) : "Registrar regreso →"}</span></div></Link>)}</div>}
    </section>
  </div>;
}
