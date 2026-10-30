"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { corregirEventoTurno } from "@/app/(app)/turno/actions";
import { CONTEXTOS_GLUCOSA, TURNOS_NOMBRES, isoDesdeFechaHoraTurnos, type ContextoGlucosa, type EventoTurno } from "@/lib/turnos";
import { TIPOS_HISTORIAL, fechaHistorial, filtrarHistorial, horaHistorial, metricasHistorial, rangoMesHistorial, sumarDiasHistorial, type EntradaHistorial, type FiltrosHistorial, type MetricasPaciente } from "@/lib/historial";

type Persona = { id: string; nombre: string; activo?: boolean };
const numero = (valor: number | null) => valor == null ? "—" : new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 }).format(valor);
const fechaVisible = (fecha: string) => new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${fecha}T12:00:00Z`));
const contextoVisible = (contexto?: string | null) => CONTEXTOS_GLUCOSA.find(c => c.value === contexto)?.label ?? contexto ?? "Sin especificar";

export default function HistorialCliente({ entradas, pacientes, personal, filtrosIniciales, hoy, esAdmin, errorCarga }: {
  entradas: EntradaHistorial[]; pacientes: Persona[]; personal: Persona[]; filtrosIniciales: FiltrosHistorial;
  hoy: string; esAdmin: boolean; errorCarga?: string;
}) {
  const [desde, setDesde] = useState(filtrosIniciales.desde);
  const [hasta, setHasta] = useState(filtrosIniciales.hasta);
  const [mes, setMes] = useState("");
  const [limite, setLimite] = useState(50);
  const nombres = useMemo(() => Object.fromEntries(pacientes.map(p => [p.id, p.nombre])), [pacientes]);
  const autores = useMemo(() => Object.fromEntries(personal.map(p => [p.id, p.nombre])), [personal]);
  const resultados = useMemo(() => errorCarga ? [] : filtrarHistorial(entradas, filtrosIniciales, nombres), [entradas, filtrosIniciales, nombres, errorCarga]);
  const metricas = useMemo(() => metricasHistorial(resultados).sort((a, b) => (nombres[a.pacienteId] ?? "").localeCompare(nombres[b.pacienteId] ?? "", "es")), [resultados, nombres]);
  const lista = resultados.slice(0, limite);

  function elegirMes(value: string) {
    setMes(value);
    if (/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) { const rango = rangoMesHistorial(value); setDesde(rango.desde); setHasta(rango.hasta); }
  }
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="eyebrow">Seguimiento de cuidados</p><h1 className="page-title mt-2">Historial</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Consulta lo que ocurrió, cuándo se registró y quién lo atendió. Busca también en las notas de registros anteriores.</p></div>
      <Link href="/turno" className="btn btn-secondary min-h-11">Ir a mi turno</Link>
    </header>

    <form action="/historial" method="get" className="card space-y-4 p-5" aria-label="Buscar en el historial">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2"><label htmlFor="historial-busqueda" className="label">Buscar en títulos y notas</label>
          <input id="historial-busqueda" type="search" name="q" defaultValue={filtrosIniciales.texto} className="input min-h-11" placeholder="Por ejemplo: vómito, dolor, visita…" maxLength={200} /></div>
        <div><label htmlFor="historial-paciente" className="label">Paciente</label><select id="historial-paciente" name="paciente" defaultValue={filtrosIniciales.paciente} className="input min-h-11"><option value="">Todos los pacientes</option>{pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.activo === false ? " · Inactivo" : ""}</option>)}</select></div>
        <div><label htmlFor="historial-tipo" className="label">Tipo de registro</label><select id="historial-tipo" name="tipo" defaultValue={filtrosIniciales.tipo} className="input min-h-11"><option value="">Todos los tipos</option>{TIPOS_HISTORIAL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div><label htmlFor="historial-desde" className="label">Desde</label><input id="historial-desde" className="input min-h-11" type="date" name="desde" required value={desde} onChange={e => { setDesde(e.target.value); setMes(""); }} /></div>
        <div><label htmlFor="historial-hasta" className="label">Hasta</label><input id="historial-hasta" className="input min-h-11" type="date" name="hasta" required value={hasta} min={desde} onChange={e => { setHasta(e.target.value); setMes(""); }} /></div>
        <div><label htmlFor="historial-mes" className="label">Elegir un mes completo</label><input id="historial-mes" type="month" className="input min-h-11" value={mes} onChange={e => elegirMes(e.target.value)} /></div>
        <div><label htmlFor="historial-turno" className="label">Turno registrado</label><select id="historial-turno" name="turno" className="input min-h-11" defaultValue={filtrosIniciales.turno}><option value="">Todos los turnos</option>{TURNOS_NOMBRES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2"><button type="button" className="btn btn-ghost min-h-11" onClick={() => { setDesde(sumarDiasHistorial(hoy, -29)); setHasta(hoy); setMes(""); }}>Últimos 30 días</button><button type="button" className="btn btn-ghost min-h-11" onClick={() => elegirMes(sumarDiasHistorial(`${hoy.slice(0, 7)}-01`, -1).slice(0, 7))}>Mes anterior</button></div>
        <button className="btn btn-primary min-h-11" type="submit">Consultar historial</button>
      </div>
    </form>

    {errorCarga ? <div role="alert" className="card border-red-200 p-5 text-sm text-red-700">{errorCarga} No se muestran promedios ni resultados parciales.</div> : <>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="section-title">{fechaVisible(filtrosIniciales.desde)} — {fechaVisible(filtrosIniciales.hasta)}</h2><p className="mt-1 text-sm text-slate-500">{filtrosIniciales.paciente ? nombres[filtrosIniciales.paciente] ?? "Paciente seleccionado" : "Todos los pacientes"} · {resultados.length} {resultados.length === 1 ? "registro" : "registros"}</p></div>
        <span className="text-xs text-slate-500">Horas de la residencia · Ciudad de México</span></div>

      {metricas.length > 0 && <section className="space-y-3" aria-labelledby="historial-promedios"><h2 id="historial-promedios" className="section-title">Mediciones del periodo</h2>
        <p className="text-sm leading-6 text-slate-500">Se calculan con los resultados de esta búsqueda y la última versión válida de cada registro. Los días y noches sin datos no cuentan como cero.</p>
        {metricas.map(m => <ResumenPaciente key={m.pacienteId} metrica={m} nombre={nombres[m.pacienteId] ?? "Paciente"} />)}
      </section>}

      <section aria-labelledby="historial-registros" className="space-y-3"><h2 id="historial-registros" className="section-title">Registros</h2>
        {filtrosIniciales.texto && <p className="text-sm text-slate-500">Búsqueda: “{filtrosIniciales.texto}”. Incluye notas originales de registros corregidos.</p>}
        {!resultados.length ? <div className="card px-5 py-12 text-center"><p className="font-semibold text-slate-800">No hay registros que coincidan</p><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Prueba otro periodo, paciente o palabra. La ausencia de un registro no confirma que un cuidado se haya realizado.</p></div> : <ol className="space-y-3">{lista.map(e => <li key={e.id}><RegistroHistorial entrada={e} nombre={e.paciente_id ? nombres[e.paciente_id] ?? "Paciente sin nombre disponible" : e.paciente_desconocido ? "Paciente no disponible" : "Actividad general"} autores={autores} esAdmin={esAdmin} /></li>)}</ol>}
        {resultados.length > limite && <button type="button" className="btn btn-secondary min-h-11 w-full" onClick={() => setLimite(limite + 50)}>Mostrar más registros ({resultados.length - limite} restantes)</button>}
      </section>
    </>}
  </div>;
}

function ResumenPaciente({ metrica: m, nombre }: { metrica: MetricasPaciente; nombre: string }) {
  return <article className="card p-5"><Link href={`/pacientes/${m.pacienteId}`} className="font-semibold text-slate-900 underline-offset-4 hover:underline">{nombre}</Link>
    <dl className="mt-4 grid gap-5 md:grid-cols-3">
      <div><dt className="text-sm font-medium text-slate-500">Glucosa promedio</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{numero(m.glucosa.promedio)} <span className="text-sm font-normal text-slate-500">mg/dL</span></dd><dd className="mt-1 text-sm text-slate-500">{m.glucosa.n ? `${m.glucosa.n} lecturas registradas` : "Sin lecturas registradas"}</dd>{m.glucosaContextos.map(c => <dd key={c.contexto} className="mt-1 text-xs leading-5 text-slate-600">{contextoVisible(c.contexto)}: {numero(c.resumen.promedio)} mg/dL · {c.resumen.n} lecturas</dd>)}</div>
      <div><dt className="text-sm font-medium text-slate-500">Cistoflo · volumen total</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{m.cistoflo.n ? numero(m.cistoflo.total) : "—"} <span className="text-sm font-normal text-slate-500">ml</span></dd><dd className="mt-1 text-sm text-slate-500">{m.cistoflo.n ? `${numero(m.cistoflo.promedio)} ml por vaciado · ${m.cistoflo.n} vaciados` : "Sin vaciados registrados"}</dd>{m.diasCistoflo > 0 && <dd className="mt-1 text-xs leading-5 text-slate-600">{numero(m.promedioCistofloDia)} ml por día registrado · {m.diasCistoflo} días con datos</dd>}</div>
      <div><dt className="text-sm font-medium text-slate-500">Sueño promedio</dt><dd className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{numero(m.sueno.promedio)} <span className="text-sm font-normal text-slate-500">h por noche</span></dd><dd className="mt-1 text-sm text-slate-500">{m.sueno.n ? `${m.sueno.n} noches registradas` : "Sin noches registradas"}</dd></div>
    </dl></article>;
}

function RegistroHistorial({ entrada: e, nombre, autores, esAdmin }: { entrada: EntradaHistorial; nombre: string; autores: Record<string, string>; esAdmin: boolean }) {
  const [corrigiendo, setCorrigiendo] = useState(false);
  const autor = e.personal_id ? autores[e.personal_id] ?? "Personal sin nombre disponible" : "Responsable no registrado";
  return <article className="card overflow-hidden">
    <div className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{fechaVisible(e.fecha)} · {e.hora ?? "Hora del evento no registrada"}{e.turno ? ` · ${TURNOS_NOMBRES.find(t => t.value === e.turno)?.label}` : ""}</p>
      <h3 className="mt-2 font-semibold text-slate-900">{e.titulo}</h3><p className="mt-1 text-sm text-marca-700">{nombre}</p></div>
      <div className="flex flex-wrap gap-2"><span className="badge bg-slate-100 text-slate-600">{TIPOS_HISTORIAL.find(t => t.value === e.tipo)?.label ?? e.tipo}</span>{e.anulado ? <span className="badge bg-red-100 text-red-700">Anulado · no cuenta en promedios</span> : e.revisiones?.length ? <span className="badge bg-marca-100 text-marca-800">Corregido</span> : null}</div></div>
      {e.valor != null && <p className="mt-3 text-xl font-semibold tabular-nums text-slate-900">{numero(e.valor)} <span className="text-sm font-normal">{e.unidad}</span>{e.tipo === "glucosa" && <span className="ml-2 text-sm font-normal text-slate-500">{contextoVisible(e.contexto)}</span>}</p>}
      {e.noche && <p className="mt-1 text-sm text-slate-500">Noche del {fechaVisible(e.noche)}</p>}
      {e.detalle && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{e.detalle}</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500">{e.revisiones?.length ? `Última corrección: ${autor}` : autor} · {e.fuente}{e.registrado_at && ` · Registrado: ${fechaVisible(fechaHistorial(e.registrado_at))}, ${horaHistorial(e.registrado_at)}`}</p>
      {e.evento?.motivo_correccion && <p className="mt-2 text-sm leading-6 text-slate-700"><strong>Motivo de {e.anulado ? "anulación" : "corrección"}:</strong> {e.evento.motivo_correccion}</p>}
      {!!e.revisiones?.length && <details className="mt-3 rounded-xl border border-slate-200 p-3"><summary className="min-h-8 cursor-pointer text-sm font-medium text-slate-700">Ver original y cambios anteriores ({e.revisiones.length})</summary><ol className="mt-3 space-y-3">{e.revisiones.map((r, i) => <li key={r.id} className="border-l-2 border-marca-200 pl-3 text-sm"><p className="font-medium text-slate-700">{i === 0 ? "Registro original" : "Versión anterior"}{r.anulado ? " · Anulado" : ""}</p><p className="mt-1 text-slate-600">{r.titulo}{r.valor != null ? ` · ${numero(r.valor)} ${r.unidad ?? ""}` : ""}{r.tipo === "glucosa" ? ` · ${contextoVisible(r.contexto)}` : ""}{r.cantidad != null ? ` · Cantidad: ${r.cantidad}` : ""}</p>{r.detalle && <p className="mt-1 whitespace-pre-wrap break-words text-slate-600">{r.detalle}</p>}<p className="mt-1 text-xs leading-5 text-slate-500">Ocurrió: {fechaVisible(fechaHistorial(r.ocurrido_at))}, {horaHistorial(r.ocurrido_at)} · {autores[r.personal_id] ?? "Personal sin nombre disponible"} · Registrado: {fechaVisible(fechaHistorial(r.registrado_at))}, {horaHistorial(r.registrado_at)}</p>{r.motivo_correccion && <p className="mt-1 text-xs text-slate-500">Motivo: {r.motivo_correccion}</p>}</li>)}</ol></details>}
      {esAdmin && e.evento && <button type="button" className="btn btn-ghost mt-3 min-h-11" aria-expanded={corrigiendo} onClick={() => setCorrigiendo(!corrigiendo)}>{corrigiendo ? "Cerrar corrección" : "Corregir registro"}</button>}
    </div>
    {corrigiendo && e.evento && <CorregirRegistro key={e.evento.id} evento={e.evento} onCancel={() => setCorrigiendo(false)} />}
  </article>;
}

function CorregirRegistro({ evento, onCancel }: { evento: EventoTurno; onCancel: () => void }) {
  const router = useRouter();
  const [valor, setValor] = useState(evento.valor?.toString() ?? "");
  const [detalle, setDetalle] = useState(evento.detalle ?? "");
  const [contexto, setContexto] = useState(evento.contexto ?? "sin_especificar");
  const [cantidad, setCantidad] = useState(evento.cantidad?.toString() ?? "");
  const fechaOriginal = fechaHistorial(evento.ocurrido_at);
  const horaOriginal = horaHistorial(evento.ocurrido_at);
  const [fechaEvento, setFechaEvento] = useState(fechaOriginal);
  const [horaEvento, setHoraEvento] = useState(horaOriginal);
  const [motivo, setMotivo] = useState("");
  const [anulado, setAnulado] = useState(evento.anulado);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const solicitudId = useRef<string | null>(null);
  const medicion = ["glucosa", "cistoflo", "sueno"].includes(evento.tipo);
  async function guardar(e: React.FormEvent) {
    e.preventDefault(); setGuardando(true); setError("");
    try {
      const cambioHora = fechaEvento !== fechaOriginal || horaEvento !== horaOriginal;
      const ocurridoAt = cambioHora ? isoDesdeFechaHoraTurnos(fechaEvento, horaEvento) : null;
      if (!anulado && cambioHora && !ocurridoAt) { setError("Revisa la fecha y hora del evento."); return; }
      solicitudId.current ??= crypto.randomUUID();
      const result = await corregirEventoTurno({ eventoId: evento.id, solicitudId: solicitudId.current, motivo, anulado,
        ...(!anulado ? { detalle } : {}),
        ...(!anulado && ocurridoAt ? { ocurridoAt } : {}),
        ...(!anulado && medicion ? { valor: valor.trim() ? Number(valor) : null } : {}),
        ...(!anulado && evento.tipo === "glucosa" ? { contexto: contexto as ContextoGlucosa } : {}),
        ...(!anulado && evento.tipo === "medicamento" && cantidad.trim() ? { cantidad: Number(cantidad) } : {}),
      });
      if (result.error || !result.ok) { setError(result.error ?? "No se pudo guardar la corrección."); return; }
      router.refresh(); onCancel();
    } catch { setError("No se pudo guardar. Comprueba la conexión e inténtalo de nuevo."); } finally { setGuardando(false); }
  }
  const prefix = `corregir-${evento.id}`;
  return <form onSubmit={guardar} className="space-y-4 border-t border-slate-200 bg-slate-50 p-5"><div><h4 className="font-semibold text-slate-800">Corregir con motivo</h4><p className="mt-1 text-sm leading-6 text-slate-500">Se guardará una nueva versión con tu nombre. El original y los cambios anteriores permanecerán visibles.</p></div>
    <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" checked={anulado} onChange={e => setAnulado(e.target.checked)} className="h-5 w-5 accent-marca-700" />Anular este registro</label>
    {!anulado && <div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label" htmlFor={`${prefix}-fecha`}>Fecha del evento</label><input id={`${prefix}-fecha`} required type="date" className="input min-h-11" value={fechaEvento} onChange={e => setFechaEvento(e.target.value)} /></div>
      <div><label className="label" htmlFor={`${prefix}-hora`}>Hora del evento en la residencia</label><input id={`${prefix}-hora`} required type="time" className="input min-h-11" value={horaEvento} onChange={e => setHoraEvento(e.target.value)} /><p className="mt-1 text-xs text-slate-500">Debe corresponder al turno original.</p></div>
      {medicion && <div><label className="label" htmlFor={`${prefix}-valor`}>Valor ({evento.unidad})</label><input id={`${prefix}-valor`} required type="number" min={evento.tipo === "glucosa" ? "0.1" : "0"} max={evento.tipo === "sueno" ? "24" : evento.tipo === "cistoflo" ? "10000" : "2000"} step="0.1" className="input min-h-11" value={valor} onChange={e => setValor(e.target.value)} /></div>}
      {evento.tipo === "glucosa" && <div><label className="label" htmlFor={`${prefix}-contexto`}>Contexto</label><select id={`${prefix}-contexto`} className="input min-h-11" value={contexto} onChange={e => setContexto(e.target.value)}>{CONTEXTOS_GLUCOSA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>}
      {evento.tipo === "medicamento" && <div><label className="label" htmlFor={`${prefix}-cantidad`}>Cantidad administrada</label><input id={`${prefix}-cantidad`} required type="number" min="0.001" step="any" className="input min-h-11" value={cantidad} onChange={e => setCantidad(e.target.value)} /><p className="mt-1 text-xs text-slate-500">Se ajusta la diferencia en existencias, conservando los conteos físicos posteriores.</p></div>}
      <div className="sm:col-span-2"><label className="label" htmlFor={`${prefix}-detalle`}>Notas</label><textarea id={`${prefix}-detalle`} className="input min-h-24" value={detalle} maxLength={4000} onChange={e => setDetalle(e.target.value)} /></div>
    </div>}
    <div><label className="label" htmlFor={`${prefix}-motivo`}>Motivo de la corrección *</label><textarea id={`${prefix}-motivo`} required minLength={3} maxLength={1000} className="input min-h-20" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Explica qué cambió y por qué" /></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={guardando} className="btn btn-primary min-h-11" type="submit">{guardando ? "Guardando…" : anulado ? "Guardar anulación" : "Guardar corrección"}</button><button disabled={guardando} className="btn btn-secondary min-h-11" type="button" onClick={onCancel}>Cancelar</button></div>
  </form>;
}
