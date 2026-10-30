"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { guardarHorariosTurno, guardarRutinaTurno, archivarRutinaTurno, actualizarAsignacionTurno, actualizarCistofloPaciente } from "@/app/(app)/administracion/actions";
import { TURNOS_NOMBRES, type AdministracionTurnosData, type ResultadoTurno, type TurnoNombre } from "@/lib/turnos";
import { DIAS_NUM } from "@/lib/constants";

function manana(fecha: string) { const d = new Date(`${fecha}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }
const horarioCorto = (hora: string) => hora.slice(0, 5);
const texto = (f: FormData, key: string) => String(f.get(key) ?? "").trim();

export default function AdministracionCliente({ datos }: { datos: AdministracionTurnosData }) {
  const router = useRouter();
  const [tab, setTab] = useState("horarios");
  const [pendiente, transicion] = useTransition();
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [retirar, setRetirar] = useState<string | null>(null);
  const actual = [...datos.horarios].filter(h => h.vigente_desde <= datos.hoy).sort((a,b) => b.vigente_desde.localeCompare(a.vigente_desde))[0];
  const proximo = [...datos.horarios].filter(h => h.vigente_desde > datos.hoy).sort((a,b) => a.vigente_desde.localeCompare(b.vigente_desde))[0];
  const base = proximo ?? actual;
  const minFecha = datos.horarios.length ? manana(datos.hoy) : datos.hoy;
  const nombres = new Map(datos.pacientes.map(p => [p.id, p.nombre]));
  function ejecutar(accion: () => Promise<ResultadoTurno>, mensaje: string, listo?: () => void) {
    if (pendiente || datos.error) return;
    setError(""); setAviso("");
    transicion(async () => {
      try { const r = await accion(); if (!r.ok) { setError(r.error ?? "No se pudo guardar. Intenta nuevamente."); return; } setAviso(mensaje); listo?.(); router.refresh(); }
      catch { setError("No se pudo conectar. Comprueba si se guardó antes de volver a intentar."); }
    });
  }
  function horarios(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    ejecutar(() => guardarHorariosTurno({ matutino:texto(f,"matutino"),vespertino:texto(f,"vespertino"),nocturno:texto(f,"nocturno"),vigenteDesde:texto(f,"desde") }), "Horarios guardados. Los registros anteriores conservan su turno original.");
  }
  function rutina(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const f = new FormData(form);
    ejecutar(() => guardarRutinaTurno({ pacienteId:texto(f,"paciente") || null,turno:texto(f,"turno") as TurnoNombre,titulo:texto(f,"titulo"),detalle:texto(f,"detalle"),diasSemana:f.getAll("dias").map(Number) }), "Actividad agregada al turno. Cada paciente tendrá su propio registro.", () => form.reset());
  }
  return <div className="space-y-6">
    <header><p className="eyebrow mb-2">Organización de la residencia</p><h1 className="page-title">Administración</h1><p className="mt-2 text-sm text-slate-600">Define los turnos y lo que necesita el equipo para comenzar.</p></header>
    <div className="flex flex-wrap gap-2" aria-label="Opciones de administración">{[{id:"horarios",label:"Horarios"},{id:"rutinas",label:"Actividades por turno"},{id:"equipo",label:"Equipo"},{id:"mediciones",label:"Cistoflo"}].map(t => <button key={t.id} type="button" aria-pressed={tab===t.id} onClick={() => { setTab(t.id); setError(""); setAviso(""); }} className={`btn ${tab===t.id?"btn-primary":"btn-secondary"}`}>{t.label}</button>)}<Link href="/medicamentos" className="btn btn-secondary">Conteo de medicamentos</Link></div>
    {datos.error && <p role="alert" className="card p-5 text-red-700">{datos.error}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    {aviso && <p role="status" className="rounded-xl bg-marca-50 p-4 text-sm text-marca-800">{aviso}</p>}
    {tab === "horarios" && <div className="grid gap-5 xl:grid-cols-2">
      <section className="card p-5 sm:p-6"><h2 className="section-title">Horario de cada turno</h2><p className="mt-2 mb-5 text-sm text-slate-600">Cada turno termina cuando comienza el siguiente. La noche continúa al día siguiente. Hora de la residencia: Ciudad de México.</p>
        <form onSubmit={horarios} key={base?.id ?? "inicial"}><fieldset disabled={pendiente || Boolean(datos.error)} className="space-y-4">
          {TURNOS_NOMBRES.map(t => <div key={t.value}><label className="label" htmlFor={`horario-${t.value}`}>Inicio del turno {t.label.toLowerCase()}</label><input id={`horario-${t.value}`} name={t.value} type="time" required className="input max-w-xs" defaultValue={base ? horarioCorto(base[t.value]) : ""} /></div>)}
          <div><label className="label" htmlFor="horario-desde">Aplicar a partir del</label><input id="horario-desde" name="desde" type="date" min={minFecha} required defaultValue={proximo?.vigente_desde ?? minFecha} className="input max-w-xs" /></div>
          <p className="text-xs leading-relaxed text-slate-500">{datos.horarios.length ? "Los cambios se programan desde mañana o una fecha posterior. No cambian los turnos ya registrados." : "Aún no hay horarios configurados. El equipo podrá entrar a su turno después de guardar esta configuración."}</p>
          <button className="btn btn-primary" type="submit">{pendiente ? "Guardando…" : "Guardar horarios"}</button>
        </fieldset></form>
      </section>
      <section className="card p-5 sm:p-6"><h2 className="section-title">Horarios guardados</h2><div className="mt-4 space-y-4">{datos.horarios.length ? [...datos.horarios].sort((a,b)=>b.vigente_desde.localeCompare(a.vigente_desde)).map(h => <article key={h.id} className="rounded-2xl border border-slate-200 p-4"><p className="font-semibold">Desde {h.vigente_desde}{h.id===actual?.id?" · Vigente":h.vigente_desde>datos.hoy?" · Próximo":" · Anterior"}</p><dl className="mt-3 space-y-2 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt>Matutino</dt><dd>{horarioCorto(h.matutino)} – {horarioCorto(h.vespertino)}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt>Vespertino</dt><dd>{horarioCorto(h.vespertino)} – {horarioCorto(h.nocturno)}</dd></div><div className="flex flex-wrap justify-between gap-2"><dt>Nocturno</dt><dd>{horarioCorto(h.nocturno)} – {horarioCorto(h.matutino)} del día siguiente</dd></div></dl></article>) : <p className="text-sm text-slate-500">Sin horarios configurados.</p>}</div><p className="mt-5 text-sm text-slate-600">El personal solo registra en el turno vigente que tenga asignado. Administración puede corregir desde el historial indicando el motivo; el original permanece visible.</p></section>
    </div>}
    {tab === "rutinas" && <div className="grid gap-5 xl:grid-cols-2">
      <section className="card p-5 sm:p-6"><h2 className="section-title mb-4">Agregar una actividad</h2><form onSubmit={rutina}><fieldset disabled={pendiente || Boolean(datos.error)} className="space-y-4">
        <div><label className="label" htmlFor="rutina-titulo">Actividad</label><input id="rutina-titulo" name="titulo" required maxLength={120} placeholder="Ej. Desayuno, baño o terapia física" className="input" /></div>
        <div><label className="label" htmlFor="rutina-turno">Turno</label><select id="rutina-turno" name="turno" className="input">{TURNOS_NOMBRES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div><label className="label" htmlFor="rutina-paciente">Para quién</label><select id="rutina-paciente" name="paciente" className="input"><option value="">Todos los pacientes activos</option>{datos.pacientes.filter(p=>p.activo).map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <fieldset><legend className="label">Días de la semana</legend><div className="flex flex-wrap gap-2">{DIAS_NUM.map(d=><label key={d.n} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm"><input type="checkbox" name="dias" value={d.n} defaultChecked />{d.label}</label>)}</div></fieldset>
        <div><label className="label" htmlFor="rutina-detalle">Indicaciones (opcional)</label><textarea id="rutina-detalle" name="detalle" maxLength={2000} rows={3} className="input" /></div>
        <button className="btn btn-primary" type="submit">{pendiente ? "Guardando…" : "Agregar al turno"}</button>
      </fieldset></form><p className="mt-4 text-xs text-slate-500">Los medicamentos se programan desde el expediente o la agenda con su indicación revisada.</p></section>
      <section className="card p-5 sm:p-6"><h2 className="section-title mb-4">Actividades del equipo</h2><div className="space-y-3">{datos.rutinas.filter(r=>r.activo).map(r=><article key={r.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{r.titulo}</h3><p className="mt-1 text-sm text-slate-600">{TURNOS_NOMBRES.find(t=>t.value===r.turno)?.label} · {r.paciente_id?nombres.get(r.paciente_id):"Todos los pacientes activos"}</p><p className="mt-1 text-xs text-slate-500">{DIAS_NUM.filter(d=>r.dias_semana.includes(d.n)).map(d=>d.label).join(" · ")}</p></div><button type="button" className="btn btn-ghost btn-sm" disabled={pendiente} onClick={()=>setRetirar(r.id)}>Retirar…</button></div>{r.detalle && <p className="mt-2 whitespace-pre-wrap text-sm">{r.detalle}</p>}{retirar===r.id && <div className="mt-3 rounded-xl bg-slate-50 p-3"><p className="mb-3 text-sm">Se retira de los pendientes; lo ya realizado permanece en el historial.</p><div className="flex gap-2"><button className="btn btn-danger btn-sm" disabled={pendiente} onClick={()=>ejecutar(()=>archivarRutinaTurno({rutinaId:r.id}),"Actividad retirada. El historial se conserva.",()=>setRetirar(null))}>Retirar actividad</button><button className="btn btn-secondary btn-sm" disabled={pendiente} onClick={()=>setRetirar(null)}>Cancelar</button></div></div>}</article>)}{!datos.rutinas.some(r=>r.activo) && <p className="text-sm text-slate-500">Agrega las actividades que debe realizar el equipo en cada turno.</p>}</div></section>
    </div>}
    {tab === "equipo" && <section className="card p-5 sm:p-6"><div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="section-title">Turno asignado al personal</h2><p className="mt-2 text-sm text-slate-600">Mixto permite trabajar en el turno vigente. Sin asignación bloquea el registro del personal.</p></div><Link href="/personal" className="btn btn-secondary">Ver personal</Link></div><div className="divide-y divide-slate-200">{datos.personal.filter(p=>p.activo).map(p=><form key={p.id} onSubmit={event=>{event.preventDefault();const f=new FormData(event.currentTarget);ejecutar(()=>actualizarAsignacionTurno({personalId:p.id,turno:(texto(f,"turno")||null) as TurnoNombre|"mixto"|null}),"Turno del integrante actualizado.");}} className="flex flex-wrap items-end gap-3 py-4"><div className="min-w-48 flex-1"><label className="label" htmlFor={`asignacion-${p.id}`}>{p.nombre}</label><select id={`asignacion-${p.id}`} name="turno" defaultValue={p.turno??""} className="input" disabled={pendiente || Boolean(datos.error)}><option value="">Sin asignación</option>{TURNOS_NOMBRES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}<option value="mixto">Mixto / rotativo</option></select></div><button type="submit" className="btn btn-secondary" disabled={pendiente || Boolean(datos.error)}>Guardar asignación</button></form>)}</div></section>}
    {tab === "mediciones" && <section className="card p-5 sm:p-6"><h2 className="section-title">Seguimiento de Cistoflo</h2><p className="mt-2 mb-5 text-sm text-slate-600">Activa el registro de volumen vaciado para los pacientes que lo necesiten. Se guarda en ml; glucosa y sueño están disponibles desde Mi turno.</p><div className="divide-y divide-slate-200">{datos.pacientes.filter(p=>p.activo).map(p=><div key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><span className="font-medium">{p.nombre}</span><button type="button" aria-pressed={p.tiene_cistoflo} className={`btn ${p.tiene_cistoflo?"btn-primary":"btn-secondary"}`} disabled={pendiente || Boolean(datos.error)} onClick={()=>ejecutar(()=>actualizarCistofloPaciente({pacienteId:p.id,tieneCistoflo:!p.tiene_cistoflo}),"Seguimiento actualizado.")}>{p.tiene_cistoflo?"Cistoflo activo · desactivar":"Activar Cistoflo"}</button></div>)}</div></section>}
  </div>;
}
