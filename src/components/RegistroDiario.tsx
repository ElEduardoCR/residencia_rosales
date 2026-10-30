"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TURNOS, COMIDAS_DIA, ML_POR_VASO, ZONA_HORARIA } from "@/lib/constants";
import { fechaEnZona } from "@/lib/utils";
import type { RegistroTurno, RegistroAlimentacion, AdministracionMedicamento, MedicamentoPaciente } from "@/lib/types";

type Props = { pacienteId: string; personal: { id: string; nombre: string }[]; obligatorios: MedicamentoPaciente[] };

/** Original daily records remain visible; all new entries use the authenticated shift. */
export default function RegistroDiario(props: Props) {
  const [fecha, setFecha] = useState(fechaEnZona(ZONA_HORARIA));
  return <div className="space-y-5">
    <section className="card space-y-3 p-5">
      <h3 className="section-title">Consulta de registros anteriores</h3>
      <p className="text-sm text-slate-600">Esta vista conserva los registros diarios originales. Los nuevos cuidados, mediciones e incidencias se guardan desde Mi turno.</p>
      <div className="flex flex-wrap gap-2"><Link className="btn btn-primary" href="/turno">Abrir mi turno</Link><Link className="btn btn-secondary" href={`/historial?paciente=${props.pacienteId}`}>Ver historial y promedios</Link></div>
      <label className="label" htmlFor="consulta-fecha">Fecha de consulta</label><input id="consulta-fecha" className="input max-w-xs" type="date" value={fecha} max={fechaEnZona(ZONA_HORARIA)} onChange={event => { if (event.target.value) setFecha(event.target.value); }} />
    </section>
    <RegistrosDelDia key={`${props.pacienteId}:${fecha}`} pacienteId={props.pacienteId} personal={props.personal} fecha={fecha} />
  </div>;
}

function RegistrosDelDia({ pacienteId, personal, fecha }: Pick<Props, "pacienteId" | "personal"> & { fecha: string }) {
  const [supabase] = useState(createClient);
  const [datos, setDatos] = useState<{ turnos: RegistroTurno[]; alimentacion: RegistroAlimentacion | null; medicamentos: AdministracionMedicamento[] } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    const abort = new AbortController();
    Promise.all([
      supabase.from("registros_turno").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha).abortSignal(abort.signal),
      supabase.from("registros_alimentacion").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha).abortSignal(abort.signal).maybeSingle(),
      supabase.from("administracion_medicamentos").select("*", { count: "exact" }).is("turno_evento_id", null).eq("paciente_id", pacienteId).eq("fecha", fecha).order("created_at").limit(1000).abortSignal(abort.signal),
    ]).then(([turnos, alimentacion, medicamentos]) => {
      if (!vigente) return;
      if (turnos.error || alimentacion.error || medicamentos.error || medicamentos.count === null || medicamentos.count > 1000) setError("No se pudo cargar el registro completo. Actualiza la página.");
      else setDatos({ turnos: turnos.data ?? [], alimentacion: alimentacion.data, medicamentos: medicamentos.data ?? [] });
    }, () => { if (vigente) setError("No se pudo conectar. Actualiza la página."); });
    return () => { vigente = false; abort.abort(); };
  }, [supabase, pacienteId, fecha]);
  const responsable = (id: string | null) => personal.find(p => p.id === id)?.nombre ?? "Sin responsable registrado";
  if (error) return <p role="alert" className="card p-5 text-red-700">{error}</p>;
  if (!datos) return <p role="status" className="card p-5 text-slate-500">Consultando registros…</p>;
  if (!datos.turnos.length && !datos.alimentacion && !datos.medicamentos.length) return <p className="card p-5 text-sm text-slate-500">No hay registros diarios originales en esta fecha. Consulta el historial para ver las nuevas anotaciones por turno.</p>;
  return <div className="space-y-4">
    {datos.turnos.length > 0 && <section className="card p-5"><h3 className="section-title mb-3">Controles por turno</h3><div className="grid gap-3 sm:grid-cols-3">{datos.turnos.map(r => <article className="rounded-xl border border-slate-200 p-4" key={r.id}><h4 className="font-semibold">{TURNOS.find(t => t.value === r.turno)?.label}</h4><p className="mt-2 text-sm">Evacuaciones: {r.evacuaciones} · Micciones: {r.orina}</p>{r.notas && <p className="mt-2 whitespace-pre-wrap text-sm">{r.notas}</p>}<p className="mt-3 text-xs text-slate-500">{responsable(r.enfermero_id)}</p></article>)}</div></section>}
    {datos.alimentacion && <section className="card p-5"><h3 className="section-title mb-3">Alimentación e hidratación</h3><p className="text-sm">{COMIDAS_DIA.filter(c => datos.alimentacion![c.key]).map(c => c.label).join(" · ") || "Sin comidas marcadas"}</p><p className="mt-2 text-sm">Agua: {datos.alimentacion.vasos_agua} vasos ({datos.alimentacion.vasos_agua * ML_POR_VASO} ml)</p>{datos.alimentacion.notas && <p className="mt-2 whitespace-pre-wrap text-sm">{datos.alimentacion.notas}</p>}<p className="mt-3 text-xs text-slate-500">{responsable(datos.alimentacion.enfermero_id)}</p></section>}
    {datos.medicamentos.length > 0 && <section className="card p-5"><h3 className="section-title mb-3">Medicamentos administrados</h3><div className="divide-y divide-slate-200">{datos.medicamentos.map(r => <article key={r.id} className="py-3"><p className="font-medium">{r.medicamento_nombre}{r.dosis ? ` · ${r.dosis}` : ""}</p><p className="text-sm text-slate-600">{r.hora?.slice(0, 5) ?? TURNOS.find(t => t.value === r.turno)?.label ?? "Sin hora"} · {responsable(r.enfermero_id)}</p>{r.motivo && <p className="mt-1 text-sm">{r.motivo}</p>}</article>)}</div></section>}
  </div>;
}
