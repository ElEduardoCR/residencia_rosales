"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { entrarAlTurno, registrarEventoTurno } from "@/app/(app)/turno/actions";
import { CONTEXTOS_GLUCOSA, TURNOS_NOMBRES, ZONA_TURNOS, eventosVigentesTurno, fechaTurnos, isoDesdeFechaHoraTurnos, validarMedicionTurno, type ContextoGlucosa, type EventoTurno, type MedicamentoTurno, type PacienteTurno, type RegistrarEventoTurnoInput, type TareaTurno, type TipoEventoTurno, type TurnoData, type VentanaTurno } from "@/lib/turnos";
import { existenciasSinVerificar, indicacionSinRevisar } from "@/lib/medication-verification";
import { iniciales } from "@/lib/utils";
import Icon from "./Icon";
import styles from "./turno.module.css";

type Seccion = "cuidados" | "medicamentos" | "mediciones" | "incidencias";
type Captura = { tipo: TipoEventoTurno; pacienteId?: string; tarea?: TareaTurno };
const TITULOS: Record<TipoEventoTurno, string> = { cuidado: "Registrar cuidado", medicamento: "Registrar administración", glucosa: "Registrar glucosa", cistoflo: "Registrar vaciado de Cistoflo", sueno: "Registrar horas de sueño", incidencia: "Registrar incidencia" };
const INCIDENCIAS = ["Vómito", "Caída", "Diarrea", "Dolor", "Otra incidencia"];

function hora(valor: string) {
  return new Intl.DateTimeFormat("es-MX", { timeZone: ZONA_TURNOS, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(valor));
}
function fechaBonita(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", { timeZone: "UTC", day: "numeric", month: "long", weekday: "long" }).format(new Date(`${fecha}T12:00:00Z`));
}
function bloqueoMedicamento(medicamento?: MedicamentoTurno) {
  if (!medicamento || !medicamento.activo) return "Medicamento no disponible.";
  if (indicacionSinRevisar(medicamento.notas) || !medicamento.dosis?.trim()) return "Indicación pendiente de revisión.";
  if (!medicamento.stock_verificado_at || existenciasSinVerificar(medicamento.notas)) return "Existencias pendientes de conteo.";
  if (!(medicamento.cantidad > 0)) return "Sin existencias disponibles.";
  return null;
}
function textoEvento(evento: EventoTurno) {
  if (evento.tipo === "glucosa") return `${evento.valor} mg/dL · ${CONTEXTOS_GLUCOSA.find(c => c.value === evento.contexto)?.label ?? "Sin especificar"}`;
  if (evento.tipo === "cistoflo") return `${evento.valor} ml vaciados`;
  if (evento.tipo === "sueno") return `${evento.valor} ${evento.valor === 1 ? "hora" : "horas"} de sueño`;
  if (evento.tipo === "medicamento") return `${evento.dosis ?? "Dosis no registrada"} · Cantidad registrada: ${evento.cantidad}`;
  return evento.detalle;
}
function Dialogo({ titulo, subtitulo, ocupado, onClose, children }: { titulo: string; subtitulo?: string; ocupado: boolean; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-label={titulo} onCancel={event => { event.preventDefault(); if (!ocupado) onClose(); }}>
    <div className={styles.dialogHeader}><div><h2>{titulo}</h2>{subtitulo && <p>{subtitulo}</p>}</div><button type="button" className="btn btn-ghost" aria-label="Cerrar ventana" disabled={ocupado} onClick={onClose}><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export default function TurnoCliente({ data }: { data: TurnoData }) {
  const router = useRouter();
  const [ahora, setAhora] = useState(data.ahora);
  const [seccion, setSeccion] = useState<Seccion>("cuidados");
  const [pacienteFiltro, setPacienteFiltro] = useState("");
  const [captura, setCaptura] = useState<Captura | null>(null);
  const [error, setError] = useState("");
  const [errorTarea, setErrorTarea] = useState<{ clave: string; mensaje: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [ocupado, guardar] = useTransition();
  const [guardandoClave, setGuardandoClave] = useState<string | null>(null);
  const [eventosGuardados, setEventosGuardados] = useState<EventoTurno[]>([]);
  const [tareasGuardadas, setTareasGuardadas] = useState<Record<string, string>>({});
  const ventana = data.contexto.ventana;
  const enHorario = Boolean(ventana && new Date(ahora).getTime() >= new Date(ventana.inicio).getTime() && new Date(ahora).getTime() < new Date(ventana.fin).getTime());
  const puedeRegistrar = Boolean(data.contexto.sesion && data.contexto.puedeEntrar && ventana?.id && enHorario && !data.error);
  const nombreTurno = TURNOS_NOMBRES.find(t => t.value === ventana?.turno)?.label;
  const pacientesPorId = useMemo(() => new Map(data.pacientes.map(p => [p.id, p])), [data.pacientes]);
  const personalPorId = useMemo(() => new Map(data.personal.map(p => [p.id, p.nombre])), [data.personal]);
  const medicamentosPorId = useMemo(() => new Map(data.medicamentos.map(m => [m.id, m])), [data.medicamentos]);
  const eventos = useMemo(() => {
    const mapa = new Map(eventosGuardados.map(e => [e.id, e]));
    data.eventos.forEach(e => mapa.set(e.id, e));
    return eventosVigentesTurno([...mapa.values()]).sort((a, b) => Date.parse(b.ocurrido_at) - Date.parse(a.ocurrido_at));
  }, [data.eventos, eventosGuardados]);
  const eventosPorId = useMemo(() => new Map(eventos.map(e => [e.id, e])), [eventos]);
  const realizada = (tarea: TareaTurno) => tarea.realizada || Boolean(tareasGuardadas[tarea.clave] && eventosPorId.has(tareasGuardadas[tarea.clave]));
  const pendientes = data.tareas.filter(t => !realizada(t));
  const tareasVisibles = data.tareas.filter(t => !pacienteFiltro || t.paciente_id === pacienteFiltro);
  const pacientesVisibles = data.pacientes.filter(p => p.activo && (!pacienteFiltro || p.id === pacienteFiltro));
  const recientes = eventos.filter(e => !pacienteFiltro || e.paciente_id === pacienteFiltro).sort((a, b) => Date.parse(b.registrado_at) - Date.parse(a.registrado_at)).slice(0, 12);
  const sinRevision = data.medicamentos.filter(m => m.activo && (indicacionSinRevisar(m.notas) || !m.dosis?.trim())).length;
  const sinConteo = data.medicamentos.filter(m => m.activo && (!m.stock_verificado_at || existenciasSinVerificar(m.notas))).length;

  useEffect(() => {
    const actualizar = () => {
      setAhora(new Date().toISOString());
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(actualizar, 30000);
    document.addEventListener("visibilitychange", actualizar);
    return () => { window.clearInterval(interval); document.removeEventListener("visibilitychange", actualizar); };
  }, [router]);

  function registrarGuardado(evento: EventoTurno | undefined, tarea?: TareaTurno) {
    if (evento) {
      setEventosGuardados(prev => [...prev.filter(e => e.id !== evento.id), evento]);
      if (tarea) setTareasGuardadas(prev => ({ ...prev, [tarea.clave]: evento.id }));
    }
    setAviso("Registro guardado. Quedó identificado con tu nombre.");
    router.refresh();
  }
  function entrar() {
    setError(""); setAviso("");
    guardar(async () => {
      try {
        const result = await entrarAlTurno();
        if (!result.ok) { setError(result.error || "No se pudo iniciar el turno. Intenta nuevamente."); return; }
        setAviso("Ya ingresaste al turno. Puedes registrar las actividades realizadas.");
        router.refresh();
      } catch { setError("No se pudo conectar. Intenta ingresar de nuevo."); }
    });
  }
  function completar(tarea: TareaTurno) {
    if (!puedeRegistrar || !ventana?.id || ocupado || tarea.anulada) return;
    if (tarea.tipo === "medicamento") { setCaptura({ tipo: "medicamento", pacienteId: tarea.paciente_id, tarea }); return; }
    setError(""); setErrorTarea(null); setAviso(""); setGuardandoClave(tarea.clave);
    guardar(async () => {
      try {
        const result = await registrarEventoTurno({ solicitudId: crypto.randomUUID(), jornadaId: ventana.id!, pacienteId: tarea.paciente_id, tipo: "cuidado", titulo: tarea.titulo, rutinaId: tarea.rutina_id, agendaTareaId: tarea.agenda_tarea_id, agendaFecha: tarea.agenda_fecha });
        if (!result.ok) { setErrorTarea({ clave: tarea.clave, mensaje: result.error || "No se guardó la actividad. Intenta nuevamente." }); return; }
        registrarGuardado(result.evento, tarea);
      } catch { setErrorTarea({ clave: tarea.clave, mensaje: "No se pudo conectar. La actividad no se ha confirmado." }); }
      finally { setGuardandoClave(null); }
    });
  }
  function grupos(tipo: "cuidado" | "medicamento") {
    const grupos = new Map<string, TareaTurno[]>();
    tareasVisibles.filter(t => t.tipo === tipo).forEach(t => { const grupo = grupos.get(t.titulo) ?? []; grupo.push(t); grupos.set(t.titulo, grupo); });
    return [...grupos.entries()];
  }
  function listaTareas(tipo: "cuidado" | "medicamento") {
    const lista = grupos(tipo);
    if (!lista.length) return <div className={styles.empty}><Icon name={tipo === "medicamento" ? "pill" : "clipboard"} /><h3>{pacienteFiltro ? "Sin actividades programadas para este paciente" : "Sin actividades programadas para este turno"}</h3><p>{tipo === "medicamento" ? "Aquí aparecen las administraciones indicadas para este turno y las que tienen una hora en la agenda." : "Aquí aparecen las rutinas de cuidado y las actividades de la agenda que corresponden a este horario."}</p>{data.usuario.esAdmin && <Link className="btn btn-secondary" href={tipo === "medicamento" ? "/medicamentos" : "/administracion"}>{tipo === "medicamento" ? "Revisar medicamentos" : "Configurar rutinas"}</Link>}</div>;
    return lista.map(([titulo, tareas]) => <section className={styles.group} key={titulo} aria-label={titulo}>
      <div className={styles.groupHeader}><div className={styles.groupTitle}><Icon name={tipo === "medicamento" ? "pill" : "clipboard"} /><h3>{titulo}</h3></div><span>{tareas.filter(t => !realizada(t)).length} pendientes</span></div>
      <ul className={styles.rows}>{tareas.map(tarea => {
        const paciente = pacientesPorId.get(tarea.paciente_id);
        const completada = realizada(tarea);
        const evento = eventosPorId.get(tarea.evento_id ?? tareasGuardadas[tarea.clave]);
        const medicamento = tarea.medicamento_id ? medicamentosPorId.get(tarea.medicamento_id) : undefined;
        const bloqueo = tipo === "medicamento" ? bloqueoMedicamento(medicamento) : null;
        return <li className={styles.row} key={tarea.clave}>
          <div className={styles.patient}><span className={styles.avatar} aria-hidden="true">{iniciales(paciente?.nombre ?? "")}</span><div className={styles.patientInfo}><div className={styles.patientName}>{paciente?.nombre ?? "Paciente"}</div>{tarea.hora && <span className={styles.tag}>{tarea.hora.includes("T") ? hora(tarea.hora) : tarea.hora.slice(0, 5)} · Agenda</span>}{tipo === "medicamento" && <p><strong>{completada && evento?.dosis ? "Dosis registrada: " : "Dosis indicada: "}</strong>{completada && evento?.dosis ? evento.dosis : medicamento?.dosis || "Pendiente de revisión"}</p>}{tarea.detalle && !(tipo === "medicamento" && (tarea.detalle === medicamento?.dosis || tarea.detalle === evento?.dosis)) && <p>{tarea.detalle}</p>}{!completada && bloqueo && <p>{bloqueo}</p>}</div></div>
          <div className={styles.rowActions}>{tarea.anulada ? <div className={styles.reviewNeeded}><span>Registro anulado</span><Link className="btn btn-secondary" href="/historial">Revisar historial</Link></div> : completada ? <div className={styles.done}><Icon name="check" /><div><strong>Realizada{evento && ` · ${hora(evento.ocurrido_at)}`}</strong><span>{tarea.autor ?? (evento ? personalPorId.get(evento.personal_id) : null) ?? "Personal de la residencia"}{evento?.corrige_id && <><br />Corregido por {personalPorId.get(evento.personal_id) ?? "administración"}</>}</span></div></div> : <button type="button" className={`btn btn-secondary ${styles.action}`} onClick={() => completar(tarea)} disabled={!puedeRegistrar || ocupado || Boolean(bloqueo)} aria-label={`${tipo === "medicamento" ? "Registrar" : "Marcar realizada"}: ${titulo}, ${paciente?.nombre ?? "paciente"}`}>{guardandoClave === tarea.clave ? "Guardando…" : tipo === "medicamento" ? "Registrar" : "Marcar realizada"}</button>}{errorTarea?.clave === tarea.clave && <p className={styles.rowError} role="alert">{errorTarea.mensaje}</p>}</div>
        </li>;
      })}</ul>
    </section>);
  }
  function ultima(pacienteId: string, tipo: TipoEventoTurno) { return eventos.find(e => e.paciente_id === pacienteId && e.tipo === tipo); }

  return <div className={styles.page}>
    <header className={styles.heading}><div><p className="eyebrow">RESIDENCIA ROSALES</p><h1 className="page-title">Mi turno</h1><p>Las actividades de todos los pacientes, en un solo lugar.</p></div><div className={styles.headingLinks}><Link href="/agenda" className="btn btn-secondary"><Icon name="calendar" /> Agenda</Link><Link href="/historial" className="btn btn-secondary"><Icon name="clipboard" /> Historial</Link></div></header>
    <section className={styles.shift} aria-label="Estado del turno">
      <div className={styles.shiftTop}><div><div className={styles.shiftName}><h2>{ventana ? `Turno ${nombreTurno?.toLowerCase()}` : "Tu jornada de cuidado"}</h2>{ventana && <span className={styles.status}><Icon name={data.contexto.sesion && enHorario ? "check" : "clock"} />{!enHorario ? "Turno finalizado" : data.contexto.sesion ? "En turno" : "Por iniciar"}</span>}</div><p className={styles.shiftDate}>{ventana ? <>{fechaBonita(ventana.fecha)} · {hora(ventana.inicio)} a {hora(ventana.fin)}{fechaTurnos(ventana.fin) !== ventana.fecha && " del día siguiente"}</> : fechaBonita(fechaTurnos(ahora))}</p></div><div className={styles.clock}><strong>{hora(ahora)}</strong><span>Hora de la residencia</span></div></div>
      <div className={styles.shiftBottom}>
        {!data.contexto.configurada ? <><p>Primero hay que definir los horarios de la residencia para abrir los turnos.</p>{data.usuario.esAdmin && <Link href="/administracion" className="btn btn-primary">Configurar horarios</Link>}</>
          : !ventana ? <p>{data.contexto.motivo || "Todavía no hay un turno disponible con los horarios configurados."}</p>
          : !enHorario ? <><p>Este turno terminó. Actualiza para ver el que está en curso.</p><button className="btn btn-secondary" onClick={() => router.refresh()}>Actualizar turno</button></>
          : data.contexto.sesion ? <><p>Registras como <strong>{data.usuario.nombre}</strong>. Cada actividad conserva quién la realizó.</p><div className={styles.progress}><meter min="0" max={Math.max(1, data.tareas.length)} value={data.tareas.length - pendientes.length} aria-label="Actividades realizadas" /><span>{data.tareas.length - pendientes.length} de {data.tareas.length} realizadas</span></div></>
          : <><p>{data.contexto.puedeEntrar ? <>Hola, <strong>{data.usuario.nombre}</strong>. Ingresa para registrar lo realizado en este turno.</> : data.contexto.motivo || "Este turno no está asignado a tu cuenta."}</p>{data.contexto.puedeEntrar && <button className="btn btn-primary" disabled={ocupado || Boolean(data.error)} onClick={entrar}><Icon name="arrow" />{ocupado ? "Ingresando…" : "Entrar al turno"}</button>}</>}
      </div>
    </section>
    {data.error && <div role="alert" className={`${styles.banner} ${styles.error}`}>{data.error} <button className="underline font-semibold" onClick={() => router.refresh()}>Volver a cargar</button></div>}
    {error && <div role="alert" className={`${styles.banner} ${styles.error}`}>{error}</div>}
    {aviso && <p role="status" className={`${styles.banner} ${styles.success}`}>{aviso}</p>}
    {ventana && <div className={styles.workspace}>
      {!puedeRegistrar && !data.error && <p className={styles.banner}>{!data.contexto.sesion && data.contexto.puedeEntrar && enHorario ? "Puedes revisar las actividades. Pulsa Entrar al turno para registrarlas." : data.contexto.motivo || "Este turno está disponible para consulta. Los registros de otros turnos se consultan en el historial."}</p>}
      <div className={styles.toolbar}><div className={styles.tabs} aria-label="Secciones del turno">{([
        ["cuidados", "Cuidados", pendientes.filter(t => t.tipo === "cuidado").length], ["medicamentos", "Medicamentos", pendientes.filter(t => t.tipo === "medicamento").length], ["mediciones", "Mediciones", null], ["incidencias", "Incidencias", null],
      ] as const).map(([value, label, count]) => <button key={value} className={styles.tab} aria-pressed={seccion === value} aria-controls="trabajo-turno" onClick={() => setSeccion(value)}>{label}{count !== null && <small aria-label={`${count} pendientes`}>{count}</small>}</button>)}</div><div className={styles.filter}><label className="label" htmlFor="filtro-paciente-turno">Mostrar pacientes</label><select id="filtro-paciente-turno" className="input" value={pacienteFiltro} onChange={e => setPacienteFiltro(e.target.value)}><option value="">Todos los pacientes ({data.pacientes.filter(p => p.activo).length})</option>{data.pacientes.filter(p => p.activo).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div></div>
      <section className={styles.panel} id="trabajo-turno" aria-label={{ cuidados: "Cuidados del turno", medicamentos: "Medicamentos del turno", mediciones: "Mediciones del turno", incidencias: "Incidencias del turno" }[seccion]}>
        {seccion === "cuidados" && <><div className={styles.panelHeading}><div><h2>Cuidados del turno</h2><p>Marca cada actividad después de realizarla.</p></div></div>{listaTareas("cuidado")}</>}
        {seccion === "medicamentos" && <><div className={styles.panelHeading}><div><h2>Medicamentos del turno</h2><p>Confirma la dosis indicada y registra la cantidad administrada.</p></div><button className="btn btn-secondary" disabled={!puedeRegistrar} onClick={() => setCaptura({ tipo: "medicamento" })}><Icon name="plus" /> Otra administración</button></div>{(sinRevision > 0 || sinConteo > 0) && <p className={styles.banner}>{sinRevision > 0 && `${sinRevision} medicamentos tienen la indicación pendiente de revisión. `}{sinConteo > 0 && `${sinConteo} requieren un conteo de existencias. `}Solo se pueden registrar medicamentos revisados y con existencias verificadas.{data.usuario.esAdmin && <> <Link href="/medicamentos">Revisar medicamentos</Link></>}</p>}{listaTareas("medicamento")}</>}
        {seccion === "mediciones" && <><div className={styles.panelHeading}><div><h2>Mediciones</h2><p>Registra los valores observados.{ventana.turno === "nocturno" && " En sueño, 0 horas significa que no durmió."}</p></div></div><div className={styles.group}><ul className={styles.rows}>{pacientesVisibles.map(p => {
          const glucosa = ultima(p.id, "glucosa"); const cistoflo = ultima(p.id, "cistoflo"); const sueno = ultima(p.id, "sueno");
          const suenoAnulado = !sueno && [...data.eventos, ...eventosGuardados].some(e => e.paciente_id === p.id && e.tipo === "sueno");
          return <li key={p.id} className={`${styles.row} ${styles.measurementRow}`}><div className={styles.patient}><span className={styles.avatar} aria-hidden="true">{iniciales(p.nombre)}</span><div className={styles.patientInfo}><div className={styles.patientName}>{p.nombre}</div><div className={styles.measurementInfo}><span>Glucosa: <strong>{glucosa ? `${glucosa.valor} mg/dL · ${hora(glucosa.ocurrido_at)}` : "Sin registro"}</strong></span>{p.tiene_cistoflo && <span>Cistoflo: <strong>{cistoflo ? `${cistoflo.valor} ml · ${hora(cistoflo.ocurrido_at)}` : "Sin registro"}</strong></span>}{ventana.turno === "nocturno" && <span>Sueño: <strong>{sueno ? `${sueno.valor} h` : suenoAnulado ? "Registro anulado" : "Sin registro"}</strong></span>}</div></div></div><div className={`${styles.rowActions} ${styles.measurementActions}`}><button className="btn btn-secondary" disabled={!puedeRegistrar} onClick={() => setCaptura({ tipo: "glucosa", pacienteId: p.id })} aria-label={`Registrar glucosa de ${p.nombre}`}>Glucosa</button>{p.tiene_cistoflo && <button className="btn btn-secondary" disabled={!puedeRegistrar} onClick={() => setCaptura({ tipo: "cistoflo", pacienteId: p.id })} aria-label={`Registrar vaciado de Cistoflo de ${p.nombre}`}>Cistoflo</button>}{ventana.turno === "nocturno" && (suenoAnulado ? <Link className="btn btn-secondary" href="/historial">Revisar sueño</Link> : <button className="btn btn-secondary" disabled={!puedeRegistrar || Boolean(sueno)} onClick={() => setCaptura({ tipo: "sueno", pacienteId: p.id })} aria-label={`Registrar horas de sueño de ${p.nombre}`}>{sueno ? "Sueño registrado" : "Sueño"}</button>)}</div></li>;
        })}</ul></div>{!pacientesVisibles.length && <p className={styles.empty}>No hay pacientes activos para mostrar.</p>}</>}
        {seccion === "incidencias" && <><div className={styles.panelHeading}><div><h2>Incidencias</h2><p>Describe lo ocurrido e indica la hora.</p></div></div><div className={styles.group}><ul className={styles.rows}>{pacientesVisibles.map(p => { const incidencia = ultima(p.id, "incidencia"); return <li className={styles.row} key={p.id}><div className={styles.patient}><span className={styles.avatar} aria-hidden="true">{iniciales(p.nombre)}</span><div className={styles.patientInfo}><div className={styles.patientName}>{p.nombre}</div><p>{incidencia ? `${incidencia.titulo} · ${hora(incidencia.ocurrido_at)}` : "Sin incidencias registradas en este turno"}</p></div></div><div className={styles.rowActions}><button className="btn btn-secondary" disabled={!puedeRegistrar} onClick={() => setCaptura({ tipo: "incidencia", pacienteId: p.id })} aria-label={`Registrar incidencia de ${p.nombre}`}><Icon name="plus" /> Registrar incidencia</button></div></li>; })}</ul></div>{!pacientesVisibles.length && <p className={styles.empty}>No hay pacientes activos para mostrar.</p>}</>}
      </section>
      <section className={styles.history} aria-label="Registros recientes"><div className={styles.historyHeader}><h2>Últimos registros del turno</h2><Link href="/historial">Ver historial</Link></div>{recientes.length ? <ol className={styles.historyList}>{recientes.map(e => <li className={styles.historyItem} key={e.id}><time dateTime={e.ocurrido_at}>{hora(e.ocurrido_at)}</time><div><strong>{pacientesPorId.get(e.paciente_id)?.nombre ?? "Paciente"} · {e.titulo}</strong>{textoEvento(e) && <p>{textoEvento(e)}</p>}{e.detalle && ["medicamento", "glucosa", "cistoflo", "sueno"].includes(e.tipo) && <p>{e.detalle}</p>}</div><span className={styles.historyAuthor}>{personalPorId.get(e.personal_id) ?? "Personal de la residencia"}{e.corrige_id && " · Corregido"}</span></li>)}</ol> : <p className={styles.banner}>Aún no hay registros{pacienteFiltro ? " de este paciente" : ""} en este turno.</p>}</section>
    </div>}
    {captura && ventana?.id && <FormularioRegistro key={`${captura.tipo}:${captura.pacienteId ?? "todos"}:${captura.tarea?.clave ?? "manual"}`} captura={captura} ventana={ventana} pacientes={data.pacientes.filter(p => p.activo)} medicamentos={data.medicamentos} eventos={eventos} nombreResponsable={data.usuario.nombre} puedeRegistrar={puedeRegistrar} onClose={() => setCaptura(null)} onSaved={evento => { registrarGuardado(evento, captura.tarea); setCaptura(null); }} />}
  </div>;
}

function FormularioRegistro({ captura, ventana, pacientes, medicamentos, eventos, nombreResponsable, puedeRegistrar, onClose, onSaved }: { captura: Captura; ventana: VentanaTurno; pacientes: PacienteTurno[]; medicamentos: MedicamentoTurno[]; eventos: EventoTurno[]; nombreResponsable: string; puedeRegistrar: boolean; onClose: () => void; onSaved: (evento?: EventoTurno) => void }) {
  const [pacienteId, setPacienteId] = useState(captura.pacienteId ?? "");
  const [medicamentoId, setMedicamentoId] = useState(captura.tarea?.medicamento_id ?? "");
  const [valor, setValor] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [contexto, setContexto] = useState<ContextoGlucosa | "">("");
  const [incidencia, setIncidencia] = useState("");
  const [detalle, setDetalle] = useState("");
  const [fecha, setFecha] = useState(() => fechaTurnos(new Date()));
  const [horaOcurrido, setHoraOcurrido] = useState(() => hora(new Date().toISOString()));
  const [error, setError] = useState("");
  const [guardando, guardar] = useTransition();
  const solicitudId = useRef<string | null>(null);
  const paciente = pacientes.find(p => p.id === pacienteId);
  const medicamento = medicamentos.find(m => m.id === medicamentoId && m.paciente_id === pacienteId);
  const medsPaciente = medicamentos.filter(m => m.paciente_id === pacienteId && m.activo);
  const administracionPrevia = eventos.find(e => e.tipo === "medicamento" && e.medicamento_id === medicamentoId && e.paciente_id === pacienteId);
  const requiereMotivo = Boolean(administracionPrevia && !captura.tarea?.agenda_tarea_id);
  const esMedicion = ["glucosa", "cistoflo", "sueno"].includes(captura.tipo);
  const bloqueo = captura.tipo === "medicamento" && medicamentoId ? bloqueoMedicamento(medicamento) : null;

  function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!puedeRegistrar || !ventana.id) { setError("Este turno ya no permite registros. Cierra esta ventana y actualiza el turno."); return; }
    if (!paciente) { setError("Selecciona un paciente."); return; }
    const ocurridoAt = isoDesdeFechaHoraTurnos(fecha, horaOcurrido);
    if (!ocurridoAt || new Date(ocurridoAt).getTime() < new Date(ventana.inicio).getTime() || new Date(ocurridoAt).getTime() >= new Date(ventana.fin).getTime()) { setError("La fecha y hora deben estar dentro de este turno."); return; }
    if (new Date(ocurridoAt).getTime() > Date.now()) { setError("La hora de lo ocurrido no puede estar en el futuro."); return; }
    if (esMedicion) {
      if (valor.trim() === "") { setError("Escribe el valor observado. Usa 0 solo cuando ese sea el valor real."); return; }
      const mensaje = validarMedicionTurno(captura.tipo, Number(valor), contexto || undefined);
      if (mensaje) { setError(mensaje); return; }
      if (captura.tipo === "glucosa" && !contexto) { setError("Selecciona el contexto de la medición de glucosa."); return; }
    }
    if (captura.tipo === "medicamento") {
      if (!medicamento || bloqueo) { setError(bloqueo || "Selecciona un medicamento revisado."); return; }
      if (!cantidad.trim() || !Number.isFinite(Number(cantidad)) || Number(cantidad) <= 0 || Number(cantidad) > medicamento.cantidad) { setError("Escribe la cantidad administrada, mayor que 0 y dentro de las existencias disponibles."); return; }
    }
    if (captura.tipo === "incidencia" && (!incidencia || !detalle.trim())) { setError("Selecciona el tipo de incidencia y describe lo ocurrido."); return; }
    if (requiereMotivo && !detalle.trim()) { setError("Describe el motivo de esta nueva administración en el turno."); return; }
    solicitudId.current ??= crypto.randomUUID();
    const input: RegistrarEventoTurnoInput = { solicitudId: solicitudId.current, jornadaId: ventana.id, pacienteId, tipo: captura.tipo, ocurridoAt, detalle: detalle.trim() || undefined,
      ...(esMedicion ? { valor: Number(valor) } : {}), ...(captura.tipo === "glucosa" && contexto ? { contexto } : {}),
      ...(captura.tipo === "incidencia" ? { titulo: incidencia } : {}),
      ...(captura.tipo === "medicamento" ? { medicamentoId, cantidad: Number(cantidad) } : {}),
      ...(captura.tarea ? { rutinaId: captura.tarea.rutina_id, agendaTareaId: captura.tarea.agenda_tarea_id, agendaFecha: captura.tarea.agenda_fecha, titulo: captura.tarea.titulo } : {}),
    };
    guardar(async () => {
      try {
        const result = await registrarEventoTurno(input);
        if (!result.ok) { setError(result.error || "No se pudo guardar. Revisa los datos e intenta nuevamente."); return; }
        onSaved(result.evento);
      } catch { setError("No se pudo confirmar el registro. Intenta guardar de nuevo."); }
    });
  }
  return <Dialogo titulo={TITULOS[captura.tipo]} subtitulo={paciente?.nombre} ocupado={guardando} onClose={onClose}>
    <form className={styles.form} onSubmit={enviar}>
      {!captura.pacienteId && <div className={styles.field}><label className="label" htmlFor="registro-paciente">Paciente</label><select className="input" id="registro-paciente" value={pacienteId} onChange={e => { setPacienteId(e.target.value); setMedicamentoId(""); setCantidad(""); }} required disabled={guardando}><option value="">Seleccionar paciente</option>{pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>}
      {captura.tipo === "medicamento" && <>
        {!captura.tarea && <div className={styles.field}><label className="label" htmlFor="registro-medicamento">Medicamento</label><select className="input" id="registro-medicamento" value={medicamentoId} onChange={e => { setMedicamentoId(e.target.value); setCantidad(""); }} required disabled={!pacienteId || guardando}><option value="">{pacienteId ? "Seleccionar medicamento" : "Primero selecciona el paciente"}</option>{medsPaciente.map(m => { const motivo = bloqueoMedicamento(m); return <option key={m.id} value={m.id} disabled={Boolean(motivo)}>{m.medicamento_nombre}{motivo ? ` · ${motivo}` : ""}</option>; })}</select>{pacienteId && !medsPaciente.some(m => !bloqueoMedicamento(m)) && <small>No hay medicamentos con indicación revisada y existencias verificadas para este paciente.</small>}</div>}
        {medicamento && <div className={styles.medicationDetail}><h3>{medicamento.medicamento_nombre}</h3><p><strong>Dosis indicada:</strong> {medicamento.dosis || "Pendiente de revisión"}</p>{medicamento.presentacion && <p><strong>Presentación:</strong> {medicamento.presentacion}</p>}<p><strong>Existencias:</strong> {bloqueo ? bloqueo : medicamento.cantidad}</p></div>}
        {administracionPrevia && <p className={styles.banner}>Este medicamento ya tiene una administración en el turno a las {hora(administracionPrevia.ocurrido_at)}. Cantidad registrada: {administracionPrevia.cantidad}.</p>}
        <div className={styles.field}><label className="label" htmlFor="registro-cantidad">Cantidad a descontar del inventario</label><input id="registro-cantidad" className="input" type="number" inputMode="decimal" min="0" max={medicamento?.cantidad} step="any" value={cantidad} onChange={e => setCantidad(e.target.value)} required disabled={guardando} aria-describedby="cantidad-ayuda" /><small id="cantidad-ayuda">Escribe la cantidad administrada usando la misma unidad del inventario. La dosis indicada aparece arriba.</small></div>
      </>}
      {esMedicion && <div className={styles.field}><label className="label" htmlFor="registro-valor">{{ glucosa: "Glucosa (mg/dL)", cistoflo: "Volumen vaciado (ml)", sueno: "Horas de sueño" }[captura.tipo as "glucosa" | "cistoflo" | "sueno"]}</label><input id="registro-valor" className="input" type="number" inputMode="decimal" min="0" max={captura.tipo === "glucosa" ? "2000" : captura.tipo === "cistoflo" ? "10000" : "24"} step="any" value={valor} onChange={e => setValor(e.target.value)} required disabled={guardando} aria-describedby="valor-ayuda" autoFocus /><small id="valor-ayuda">{captura.tipo === "sueno" ? "Deja el campo vacío si aún no lo sabes. Registra 0 si no durmió." : captura.tipo === "cistoflo" ? "Registra el volumen vaciado en esta ocasión, en mililitros." : "Escribe el resultado medido en mg/dL."}</small></div>}
      {captura.tipo === "glucosa" && <div className={styles.field}><label className="label" htmlFor="registro-contexto">Contexto de la medición</label><select id="registro-contexto" className="input" value={contexto} onChange={e => setContexto(e.target.value as ContextoGlucosa)} required disabled={guardando}><option value="">Seleccionar contexto</option>{CONTEXTOS_GLUCOSA.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}</select></div>}
      {captura.tipo === "incidencia" && <div className={styles.field}><label className="label" htmlFor="registro-incidencia">Tipo de incidencia</label><select id="registro-incidencia" className="input" value={incidencia} onChange={e => setIncidencia(e.target.value)} required disabled={guardando}><option value="">Seleccionar tipo</option>{INCIDENCIAS.map(t => <option key={t}>{t}</option>)}</select></div>}
      <div className={styles.formGrid}><div className={styles.field}><label className="label" htmlFor="registro-fecha">Fecha de lo ocurrido</label><input id="registro-fecha" className="input" type="date" min={fechaTurnos(ventana.inicio)} max={fechaTurnos(new Date())} value={fecha} onChange={e => setFecha(e.target.value)} required disabled={guardando} /></div><div className={styles.field}><label className="label" htmlFor="registro-hora">Hora de lo ocurrido</label><input id="registro-hora" className="input" type="time" value={horaOcurrido} onChange={e => setHoraOcurrido(e.target.value)} required disabled={guardando} /><small>Hora de la residencia · {hora(ventana.inicio)} a {hora(ventana.fin)}</small></div></div>
      <div className={styles.field}><label className="label" htmlFor="registro-detalle">{captura.tipo === "incidencia" ? "Descripción de lo ocurrido" : requiereMotivo ? "Motivo de esta nueva administración" : "Observaciones (opcional)"}</label><textarea id="registro-detalle" className="input" rows={3} maxLength={4000} value={detalle} onChange={e => setDetalle(e.target.value)} required={captura.tipo === "incidencia" || requiereMotivo} disabled={guardando} /></div>
      <p className={styles.responsible}>Se registrará a nombre de <strong>{nombreResponsable}</strong>. Las correcciones se solicitan a administración y conservan el historial.</p>
      {error && <p className={`${styles.banner} ${styles.error}`} role="alert">{error}</p>}
      {!puedeRegistrar && <p className={`${styles.banner} ${styles.error}`} role="alert">Este turno ya no permite registros. Cierra la ventana y actualiza.</p>}
      <div className={styles.formFooter}><button type="button" className="btn btn-secondary" disabled={guardando} onClick={onClose}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={guardando || !puedeRegistrar || Boolean(bloqueo)}>{guardando ? "Guardando…" : "Guardar registro"}</button></div>
    </form>
  </Dialogo>;
}
