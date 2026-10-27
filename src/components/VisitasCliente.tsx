"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatFecha, fechaEnZona } from "@/lib/utils";
import { PARENTESCOS, ZONA_HORARIA } from "@/lib/constants";
import type { Visita } from "@/lib/types";

type VisitaConPaciente = Visita & { pacientes?: { nombre: string } | null };
export default function VisitasCliente({ visitas, pacientes }: { visitas: VisitaConPaciente[]; pacientes: { id: string; nombre: string }[] }) {
  const supabase = createClient();
  const enviando = useRef(false);
  const [lista, setLista] = useState(visitas);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState("");
  const vacio = () => ({ visitante_nombre: "", parentesco: "", paciente_id: "", fecha: fechaEnZona(ZONA_HORARIA), hora_entrada: "", motivo: "" });
  const [v, setV] = useState(vacio);

  async function agregarVisita(event: React.FormEvent) {
    event.preventDefault();
    if (enviando.current) return;
    if (!v.visitante_nombre.trim()) return setError("Indica el nombre del visitante.");
    enviando.current = true; setGuardando(true); setError(null); setMensaje("");
    try {
      const { data, error: guardarError } = await supabase.from("visitas").insert({ visitante_nombre: v.visitante_nombre.trim(), parentesco: v.parentesco || null, paciente_id: v.paciente_id || null, fecha: v.fecha, hora_entrada: v.hora_entrada || null, motivo: v.motivo.trim() || null }).select("*, pacientes(nombre)").single();
      if (guardarError || !data) throw new Error("No se pudo guardar la visita. Revisa tu conexión e intenta nuevamente.");
      setLista((prev) => [data, ...prev]); setV(vacio()); setMensaje("Visita registrada.");
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar la visita."); }
    finally { enviando.current = false; setGuardando(false); }
  }

  return <div className="space-y-5">
    <div className="flex justify-end"><Link href="/salidas" className="btn btn-secondary">Abrir registro de salida →</Link></div>
    <form onSubmit={agregarVisita} className="card p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold text-slate-900">Registrar visita</h2><fieldset disabled={guardando} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label><span className="label">Nombre del visitante *</span><input className="input" required value={v.visitante_nombre} onChange={(e) => setV({ ...v, visitante_nombre: e.target.value })} /></label>
      <label><span className="label">Residente</span><select className="input" value={v.paciente_id} onChange={(e) => setV({ ...v, paciente_id: e.target.value })}><option value="">Visita general</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      <label><span className="label">Parentesco</span><select className="input" value={v.parentesco} onChange={(e) => setV({ ...v, parentesco: e.target.value })}><option value="">Selecciona</option>{PARENTESCOS.map((p) => <option key={p}>{p}</option>)}</select></label>
      <label><span className="label">Fecha *</span><input type="date" className="input" required value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} /></label>
      <label><span className="label">Hora de entrada</span><input type="time" className="input" value={v.hora_entrada} onChange={(e) => setV({ ...v, hora_entrada: e.target.value })} /></label>
      <label><span className="label">Motivo</span><input className="input" value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} /></label>
    </fieldset>{error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}{mensaje && <p role="status" className="mt-4 text-sm text-emerald-700">{mensaje}</p>}<button type="submit" disabled={guardando} className="btn btn-primary mt-5">{guardando ? "Guardando…" : "Registrar visita"}</button></form>
    <section aria-label="Historial de visitas" className="space-y-3"><h2 className="text-lg font-semibold text-slate-900">Últimas visitas</h2>{!lista.length ? <div className="card p-8 text-center text-sm text-slate-500">Aún no hay visitas registradas.</div> : lista.map((visita) => <div key={visita.id} className="card flex flex-wrap justify-between gap-3 p-5"><div><p className="font-medium text-slate-800">{visita.visitante_nombre}</p><p className="mt-1 text-sm text-slate-500">{visita.pacientes?.nombre ?? "Visita general"}{visita.parentesco ? ` · ${visita.parentesco}` : ""}</p>{visita.motivo && <p className="mt-1 text-sm text-slate-600">{visita.motivo}</p>}</div><p className="text-sm text-slate-500">{formatFecha(visita.fecha)} · {visita.hora_entrada?.slice(0, 5) || "Sin hora"}</p></div>)}</section>
  </div>;
}
