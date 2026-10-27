"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { crearTareaAgenda, realizarTareaAgenda, desactivarTareaAgenda } from "@/app/(app)/agenda/actions";
import { TIPOS_AGENDA, fechaHoraAgenda, minutosAgenda, tareaOcurreEnFecha, estadoTareaAgenda, type AgendaPersona, type AgendaMedicamento, type AgendaTarea, type AgendaRealizacion, type TipoAgenda } from "@/lib/agenda";
import { indicacionSinRevisar } from "@/lib/medication-verification";
import { DIAS_NUM, ZONA_HORARIA } from "@/lib/constants";
import { iniciales } from "@/lib/utils";
import Icon, { type IconName } from "./Icon";
import styles from "./agenda.module.css";

const HORA_PX = 176;
const TARJETA_PX = 160;
const CARRIL_PX = 126;
const DIA_PX = 24 * HORA_PX + TARJETA_PX;
const HORAS = Array.from({ length: 25 }, (_, i) => i);
const ICONOS: Record<TipoAgenda, IconName> = { medicamento: "pill", alimentacion: "menu", terapia: "heart", higiene: "clipboard", visita: "visits", otro: "calendar" };
const ESTADOS = { completada: "Realizada", pendiente: "Pendiente", vencida: "Sin realizar" };

type Props = {
  pacientes: AgendaPersona[]; personal: AgendaPersona[]; tareas: AgendaTarea[];
  realizaciones: AgendaRealizacion[]; medicamentos: AgendaMedicamento[];
  fecha: string; hoy: string; ahora: string; esAdmin: boolean; miPersonalId: string | null; errorCarga?: string;
};

function moverFecha(fecha: string, dias: number) {
  const date = new Date(`${fecha}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + dias);
  return date.toISOString().slice(0, 10);
}
function fechaBonita(fecha: string) {
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", weekday: "long", timeZone: "UTC" }).format(new Date(`${fecha}T12:00:00Z`));
}
function horaRegistro(valor: string) {
  return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: ZONA_HORARIA }).format(new Date(valor));
}
function retiradaEnFecha(tarea: AgendaTarea, fecha: string) {
  return !tarea.activo && Boolean(tarea.archivada_at) && fecha >= fechaHoraAgenda(tarea.archivada_at!).fecha;
}
function acomodar(tareas: AgendaTarea[]) {
  const finales: number[] = [];
  const posiciones = [...tareas].sort((a, b) => a.hora.localeCompare(b.hora) || a.id.localeCompare(b.id)).map(tarea => {
    const izquierda = minutosAgenda(tarea.hora) / 60 * HORA_PX;
    let carril = finales.findIndex(fin => fin + 8 <= izquierda);
    if (carril < 0) carril = finales.length;
    finales[carril] = izquierda + TARJETA_PX;
    return { tarea, izquierda, carril };
  });
  return { posiciones, alto: Math.max(1, finales.length) * CARRIL_PX + 20 };
}

function Dialogo({ titulo, onClose, children, ocupado = false }: { titulo: string; onClose: () => void; children: ReactNode; ocupado?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-label={titulo} onCancel={event => { event.preventDefault(); if (!ocupado) onClose(); }}>
    <div className={styles.dialogHeader}><h2>{titulo}</h2><button type="button" className="btn btn-ghost" onClick={onClose} disabled={ocupado} aria-label="Cerrar ventana"><Icon name="close" /></button></div>
    {children}
  </dialog>;
}

export default function AgendaCliente({ pacientes, personal, tareas, realizaciones, medicamentos, fecha, hoy, ahora, esAdmin, miPersonalId, errorCarga }: Props) {
  const router = useRouter();
  const [navegando, navegar] = useTransition();
  const [ahoraISO, setAhoraISO] = useState(ahora);
  const [pacienteFiltro, setPacienteFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [observaciones, setObservaciones] = useState("");
  const [guardando, guardarTransicion] = useTransition();
  const [confirmarArchivo, setConfirmarArchivo] = useState(false);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [realizadasLocal, setRealizadasLocal] = useState<AgendaRealizacion[]>([]);
  const [tareasLocal, setTareasLocal] = useState<AgendaTarea[]>([]);
  const [archivadasLocal, setArchivadasLocal] = useState<{ id: string; fecha: string }[]>([]);
  const scroll = useRef<HTMLDivElement>(null);
  const nombreColumna = useRef<HTMLDivElement>(null);
  const posicionInicial = useRef(false);
  const reloj = fechaHoraAgenda(new Date(ahoraISO));
  const esHoy = fecha === reloj.fecha;
  const horaAhora = `${String(Math.floor(reloj.minutos / 60)).padStart(2, "0")}:${String(reloj.minutos % 60).padStart(2, "0")}`;

  useEffect(() => {
    const actualizar = () => {
      const actual = new Date().toISOString();
      setAhoraISO(actual);
      if (document.visibilityState === "visible") {
        const actualFecha = fechaHoraAgenda(actual).fecha;
        if (fecha === hoy && actualFecha !== fecha) router.replace(`/agenda?fecha=${actualFecha}`, { scroll: false });
        else router.refresh();
      }
    };
    const tick = window.setInterval(actualizar, 30000);
    document.addEventListener("visibilitychange", actualizar);
    return () => { window.clearInterval(tick); document.removeEventListener("visibilitychange", actualizar); };
  }, [router, fecha, hoy]);

  const todasTareas = useMemo(() => {
    const mapa = new Map(tareasLocal.map(t => [t.id, t]));
    tareas.forEach(t => mapa.set(t.id, t));
    return [...mapa.values()].map(t => {
      const archivada = archivadasLocal.find(a => a.id === t.id);
      return archivada ? { ...t, activo: false, archivada_at: t.archivada_at || archivada.fecha } : t;
    });
  }, [tareas, tareasLocal, archivadasLocal]);
  const hechas = useMemo(() => {
    const mapa = new Map(realizaciones.map(r => [r.tarea_id, r]));
    realizadasLocal.filter(r => r.fecha === fecha).forEach(r => mapa.set(r.tarea_id, r));
    return mapa;
  }, [realizaciones, realizadasLocal, fecha]);
  const nombresPersonal = new Map(personal.map(p => [p.id, p.nombre]));
  const nombresPacientes = new Map(pacientes.map(p => [p.id, p.nombre]));
  const miNombre = miPersonalId ? nombresPersonal.get(miPersonalId) : null;
  const tareasDelDia = todasTareas.filter(t => tareaOcurreEnFecha(t, fecha) || hechas.has(t.id));
  const tareasVisibles = tareasDelDia.filter(t => (!pacienteFiltro || t.paciente_id === pacienteFiltro) && (!tipoFiltro || t.tipo === tipoFiltro));
  const pacientesActivos = pacientes.filter(p => p.activo !== false);
  const pacientesVisibles = pacientes.filter(p => !pacienteFiltro || p.id === pacienteFiltro);
  const tareasSeguimiento = tareasVisibles.filter(t => hechas.has(t.id) || !retiradaEnFecha(t, fecha));
  const completadas = tareasSeguimiento.filter(t => hechas.has(t.id)).length;
  const vencidas = tareasSeguimiento.filter(t => estadoTareaAgenda(t, fecha, hechas.get(t.id), ahoraISO) === "vencida").length;
  const seleccionada = todasTareas.find(t => t.id === seleccion);
  const registro = seleccionada ? hechas.get(seleccionada.id) : undefined;
  const medSeleccionada = seleccionada?.medicamento_id ? medicamentos.find(m => m.id === seleccionada.medicamento_id) : undefined;
  const medNoDisponible = seleccionada?.tipo === "medicamento" && (!medSeleccionada || !medSeleccionada.activo || indicacionSinRevisar(medSeleccionada.notas));
  const medsPendientes = medicamentos.filter(m => m.activo && indicacionSinRevisar(m.notas)).length;
  const porcentaje = tareasSeguimiento.length ? Math.round(completadas / tareasSeguimiento.length * 100) : 0;

  function centrar(minutos: number) {
    if (!scroll.current) return;
    const anchoNombre = nombreColumna.current?.getBoundingClientRect().width ?? 180;
    const destino = minutos / 60 * HORA_PX - (scroll.current.clientWidth - anchoNombre) / 2;
    scroll.current.scrollTo({ left: Math.max(0, destino), behavior: "auto" });
  }
  useEffect(() => {
    if (posicionInicial.current) return;
    const initial = fechaHoraAgenda(new Date(ahora));
    const primera = tareas.filter(t => tareaOcurreEnFecha(t, fecha)).sort((a, b) => a.hora.localeCompare(b.hora))[0];
    const punto = fecha === initial.fecha ? initial.minutos : primera ? minutosAgenda(primera.hora) : 8 * 60;
    const frame = requestAnimationFrame(() => {
      if (!scroll.current) return;
      posicionInicial.current = true;
      const anchoNombre = nombreColumna.current?.getBoundingClientRect().width ?? 180;
      scroll.current.scrollLeft = Math.max(0, punto / 60 * HORA_PX - (scroll.current.clientWidth - anchoNombre) / 2);
    });
    return () => cancelAnimationFrame(frame);
  }, [ahora, fecha, tareas]);

  function cambiarFecha(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    setSeleccion(null); setCreando(false); setError("");
    navegar(() => router.push(`/agenda?fecha=${encodeURIComponent(value)}`, { scroll: false }));
  }
  function abrirTarea(id: string) { setSeleccion(id); setObservaciones(""); setError(""); setConfirmarArchivo(false); }
  function completar() {
    if (!seleccionada || guardando) return;
    setError("");
    guardarTransicion(async () => {
      try {
        const r = await realizarTareaAgenda({ tareaId: seleccionada.id, fecha, observaciones });
        if (!r.ok || !r.realizacion) { setError(r.error || "No se pudo guardar. Intenta de nuevo."); return; }
        setRealizadasLocal(prev => [...prev.filter(x => x.tarea_id !== r.realizacion!.tarea_id), r.realizacion!]);
        setAviso(r.yaRegistrada ? "Esta tarea ya había sido registrada. Se conserva el registro original." : "Tarea realizada. La hora y tu nombre quedaron registrados.");
        router.refresh();
      } catch { setError("No se pudo conectar. Tus cambios no se han guardado; intenta de nuevo."); }
    });
  }
  function archivar() {
    if (!seleccionada || guardando) return;
    setError("");
    guardarTransicion(async () => {
      try {
        const r = await desactivarTareaAgenda({ tareaId: seleccionada.id });
        if (!r.ok) { setError(r.error || "No se pudo retirar la programación."); return; }
        if (r.archivada_at) setArchivadasLocal(prev => [...prev, { id: seleccionada.id, fecha: r.archivada_at! }]);
        setSeleccion(null); setAviso("Programación retirada. Los registros anteriores se conservan."); router.refresh();
      } catch { setError("No se pudo conectar. La programación sigue activa."); }
    });
  }

  return <div className={styles.root}>
    <header className={styles.heading}>
      <div><p className="eyebrow mb-2">CADA CUIDADO, A SU HORA</p><h1 className="page-title">Agenda de cuidados</h1><p className={styles.subtitle}>El día de cada paciente, en una sola vista.</p></div>
      {esAdmin && <button type="button" className="btn btn-primary" disabled={Boolean(errorCarga) || pacientesActivos.length === 0} onClick={() => { setCreando(true); setAviso(""); }}><Icon name="plus" />Programar cuidado</button>}
    </header>
    <section className={styles.overview} aria-label="Avance del día">
      <div className={styles.progressLabel}><span className={styles.progressNumber}>{completadas}<small> / {tareasSeguimiento.length}</small></span><span>cuidados realizados</span></div>
      <div className={styles.progress}><div role="progressbar" aria-label="Cuidados realizados" aria-valuemin={0} aria-valuemax={tareasSeguimiento.length || 1} aria-valuenow={completadas} className={styles.progressTrack}><span style={{ width: `${porcentaje}%` }} /></div><p>{tareasSeguimiento.length ? `${porcentaje}% del día completado` : "Programa los cuidados para comenzar"}</p></div>
      <div className={styles.metrics}><span><b>{tareasSeguimiento.length - completadas}</b>Pendientes</span><span className={vencidas ? styles.overdueText : ""}><b>{vencidas}</b>Hora pasada</span></div>
    </section>
    {errorCarga && <div role="alert" className={styles.error}>{errorCarga} <button className="btn btn-secondary btn-sm" onClick={() => router.refresh()}>Volver a cargar</button></div>}
    {aviso && <p role="status" className={styles.notice}>{aviso}</p>}
    <section className={styles.board} aria-label="Agenda por paciente y hora">
      <div className={styles.toolbar}>
        <div className={styles.dateControls}>
          <button className="btn btn-ghost" aria-label="Día anterior" disabled={navegando} onClick={() => cambiarFecha(moverFecha(fecha, -1))}>‹</button>
          <label className={styles.dateLabel}><span className="sr-only">Fecha de la agenda</span><input type="date" value={fecha} disabled={navegando} onChange={e => cambiarFecha(e.target.value)} /></label>
          <button className="btn btn-ghost" aria-label="Día siguiente" disabled={navegando} onClick={() => cambiarFecha(moverFecha(fecha, 1))}>›</button>
          <button className="btn btn-secondary btn-sm" disabled={navegando} onClick={() => { if (esHoy) centrar(reloj.minutos); else cambiarFecha(reloj.fecha); }}>Hoy</button>
        </div>
        <div className={styles.filters}>
          <label><span className="sr-only">Filtrar paciente</span><select className="input" value={pacienteFiltro} onChange={e => setPacienteFiltro(e.target.value)}><option value="">Todos los pacientes</option>{pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
          <label><span className="sr-only">Filtrar tipo de cuidado</span><select className="input" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}><option value="">Todos los cuidados</option>{TIPOS_AGENDA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
        </div>
      </div>
      <div className={styles.boardCaption}><div><strong>{esHoy ? "Hoy" : fechaBonita(fecha)}</strong><span>Hora de la residencia · {ZONA_HORARIA === "America/Mexico_City" ? "Ciudad de México" : ZONA_HORARIA}</span></div>{esHoy && <button type="button" className={styles.nowButton} onClick={() => centrar(reloj.minutos)}><span className={styles.liveDot} />Ahora · {horaAhora}</button>}</div>
      <div ref={scroll} className={styles.scroll} tabIndex={0} role="region" aria-label="Línea de tiempo de 24 horas. Desplázate horizontalmente para ver otras horas." aria-busy={navegando} style={{ "--hora-px": `${HORA_PX}px`, "--dia-px": `${DIA_PX}px` } as CSSProperties}>
        <div className={styles.grid}>
          <div className={styles.hourRow}>
            <div ref={nombreColumna} className={styles.corner}>PACIENTE <span>HORAS →</span></div>
            <div className={styles.hours}>{HORAS.map(h => <span key={h} className={styles.hour} style={{ left: h * HORA_PX }}>{String(h).padStart(2, "0")}:00</span>)}{esHoy && <span aria-hidden="true" className={styles.nowHeader} style={{ left: reloj.minutos / 60 * HORA_PX }}>{horaAhora}</span>}</div>
          </div>
          {pacientesVisibles.map(p => {
            const { posiciones, alto } = acomodar(tareasVisibles.filter(t => t.paciente_id === p.id));
            const realizadas = posiciones.filter(({ tarea }) => hechas.has(tarea.id)).length;
            const enSeguimiento = posiciones.filter(({ tarea }) => hechas.has(tarea.id) || !retiradaEnFecha(tarea, fecha)).length;
            return <div key={p.id} className={styles.patientRow} style={{ minHeight: alto }}>
              <div className={styles.patientName}><span className={styles.avatar}>{iniciales(p.nombre)}</span><div><Link href={`/pacientes/${p.id}`}>{p.nombre}</Link>{p.activo === false && <span className={styles.inactive}>Inactivo · historial</span>}<small>{enSeguimiento ? `${realizadas} de ${enSeguimiento} realizados` : posiciones.length ? "Programación retirada" : "Sin cuidados programados"}</small></div></div>
              <div className={styles.patientPlot} style={{ height: alto }}>
                {posiciones.map(({ tarea, izquierda, carril }) => {
                  const realizada = hechas.get(tarea.id);
                  const estado = estadoTareaAgenda(tarea, fecha, realizada, ahoraISO);
                  const retirada = !realizada && retiradaEnFecha(tarea, fecha);
                  const etiquetaEstado = retirada ? "Retirada" : ESTADOS[estado];
                  const autor = realizada ? nombresPersonal.get(realizada.personal_id) || "Personal registrado" : "";
                  const tipo = TIPOS_AGENDA.find(t => t.value === tarea.tipo)?.label;
                  return <button key={tarea.id} type="button" className={`${styles.task} ${retirada ? styles.retirada : styles[estado] || ""}`} style={{ left: izquierda, top: 12 + carril * CARRIL_PX, width: TARJETA_PX }} onClick={() => abrirTarea(tarea.id)} aria-label={`${tarea.hora.slice(0, 5)}, ${tarea.titulo}, ${p.nombre}. ${etiquetaEstado}${realizada ? ` por ${autor} a las ${horaRegistro(realizada.realizada_at)}` : ""}`}>
                    <span className={styles.taskTop}><span><Icon name={ICONOS[tarea.tipo]} width="14" height="14" />{tarea.hora.slice(0, 5)}</span><span>{tipo}</span></span>
                    <strong>{tarea.titulo}</strong>
                    <span className={styles.taskStatus}>{realizada ? <><Icon name="check" width="13" height="13" />{autor.split(" ")[0]} · {horaRegistro(realizada.realizada_at)}</> : <><span className={styles.statusDot} />{etiquetaEstado}</>}</span>
                  </button>;
                })}
              </div>
            </div>;
          })}
          {esHoy && pacientesVisibles.length > 0 && <div className={styles.nowLine} aria-hidden="true" style={{ left: `calc(var(--nombre-px) + ${reloj.minutos / 60 * HORA_PX}px)` }} />}
        </div>
      </div>
      <div className={styles.boardFooter}><span>Desliza para recorrer las 24 horas. Selecciona un cuidado para registrar su realización.</span><div><span><i className={styles.pendingDot} />Pendiente</span><span><i className={styles.overdueDot} />Hora pasada</span><span><i className={styles.doneDot} />Realizada</span></div></div>
    </section>
    {!errorCarga && tareasVisibles.length === 0 && <div className={styles.empty}><span className="icon-tile"><Icon name="calendar" /></span><div><h2>{tareasDelDia.length ? "No hay cuidados con estos filtros" : "El día está listo para organizarse"}</h2><p>{tareasDelDia.length ? "Prueba con otro paciente o tipo de cuidado." : esAdmin ? "Programa medicamentos revisados, comidas, terapia, baño o visitas a la hora que corresponda." : "La administración puede programar los cuidados de cada paciente."}</p></div>{esAdmin && !tareasDelDia.length && <button className="btn btn-secondary" disabled={pacientesActivos.length === 0} onClick={() => setCreando(true)}>Programar cuidado</button>}</div>}
    {medsPendientes > 0 && <aside className={styles.medNote}><Icon name="pill" /><p><strong>{medsPendientes} {medsPendientes === 1 ? "medicamento pendiente" : "medicamentos pendientes"} de revisión.</strong> Confirma la indicación en el expediente antes de asignar una hora en la agenda.</p><Link href="/pacientes" className="btn btn-ghost btn-sm">Ver expedientes <Icon name="arrow" width="16" height="16" /></Link></aside>}

    {seleccionada && <Dialogo titulo="Detalle del cuidado" onClose={() => { if (!guardando) setSeleccion(null); }} ocupado={guardando}>
      <div className={styles.dialogBody}>
        <p className={styles.detailType}><Icon name={ICONOS[seleccionada.tipo]} />{TIPOS_AGENDA.find(t => t.value === seleccionada.tipo)?.label} · {seleccionada.hora.slice(0, 5)}</p>
        <h3 className={styles.detailTitle}>{seleccionada.titulo}</h3>
        <p className={styles.detailPatient}>{nombresPacientes.get(seleccionada.paciente_id)}<span>{fechaBonita(fecha)}</span></p>
        {seleccionada.descripcion && <p className={styles.description}>{seleccionada.descripcion}</p>}
        {medSeleccionada && <div className={styles.detailPanel}><strong>{medSeleccionada.medicamento_nombre}</strong><p>Dosis actual del expediente: {medSeleccionada.dosis || "Sin especificar"}</p><Link href={`/pacientes/${seleccionada.paciente_id}`}>Ver indicación en el expediente →</Link></div>}
        {registro ? <div className={styles.completedPanel}><Icon name="check" /><div><strong>Realizada por {nombresPersonal.get(registro.personal_id) || "Personal registrado"}</strong><p>Registrada a las {horaRegistro(registro.realizada_at)} · {fechaBonita(fechaHoraAgenda(new Date(registro.realizada_at)).fecha)}</p>{registro.observaciones && <p className={styles.description}>{registro.observaciones}</p>}</div></div> : <>
          {medNoDisponible && <p role="alert" className={styles.error}>La indicación de este medicamento está pendiente de revisión o ya no está activa. Revisa el expediente antes de registrarlo.</p>}
          {!seleccionada.activo && <p className={styles.notice}>Esta programación fue retirada. Se conserva aquí como historial.</p>}
          {fecha > reloj.fecha && <p className={styles.notice}>Podrás registrar este cuidado el día programado.</p>}
          <label className="label" htmlFor="agenda-observaciones">Observaciones <span className={styles.optional}>(opcional)</span></label>
          <textarea id="agenda-observaciones" className="input" rows={3} maxLength={1000} value={observaciones} disabled={guardando || !seleccionada.activo || fecha > reloj.fecha || medNoDisponible} onChange={e => setObservaciones(e.target.value)} placeholder="Información sobre el cuidado realizado" />
          <p className={styles.helper}>{miNombre ? `Al confirmar se guardará el nombre de ${miNombre} y la hora real del registro.` : "Necesitas iniciar sesión con una cuenta de personal para registrar el cuidado."}</p>
          <button type="button" onClick={completar} disabled={guardando || !miPersonalId || Boolean(errorCarga) || !seleccionada.activo || fecha > reloj.fecha || medNoDisponible} className="btn btn-primary w-full"><Icon name="check" />{guardando ? "Guardando…" : "Confirmar que ya se realizó"}</button>
        </>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        {esAdmin && seleccionada.activo && <div className={styles.archive}>{confirmarArchivo ? <><p>¿Retirar esta programación? Los cuidados realizados permanecerán en el historial.</p><div className={styles.formActions}><button className="btn btn-danger" disabled={guardando} onClick={archivar}>Retirar programación</button><button className="btn btn-secondary" disabled={guardando} onClick={() => setConfirmarArchivo(false)}>Cancelar</button></div></> : <button className="btn btn-ghost btn-sm" disabled={guardando} onClick={() => setConfirmarArchivo(true)}>Retirar programación…</button>}</div>}
      </div>
    </Dialogo>}
    {creando && <ProgramarDialog pacientes={pacientesActivos} medicamentos={medicamentos} fecha={fecha < reloj.fecha ? reloj.fecha : fecha} hoy={reloj.fecha} onClose={() => setCreando(false)} onCreated={nuevas => { setTareasLocal(prev => [...prev, ...nuevas]); setCreando(false); setAviso(`${nuevas.length === 1 ? "Cuidado programado" : `${nuevas.length} cuidados programados`}. Cada paciente tendrá su propio registro.`); router.refresh(); }} />}
  </div>;
}

function ProgramarDialog({ pacientes, medicamentos, fecha, hoy, onClose, onCreated }: { pacientes: AgendaPersona[]; medicamentos: AgendaMedicamento[]; fecha: string; hoy: string; onClose: () => void; onCreated: (tareas: AgendaTarea[]) => void }) {
  const [form, setForm] = useState({ paciente: "", tipo: "alimentacion" as TipoAgenda, titulo: "", descripcion: "", hora: "", inicio: fecha, fin: "", repetir: false, dias: [0, 1, 2, 3, 4, 5, 6], medicamento: "" });
  const [guardando, guardar] = useTransition();
  const [error, setError] = useState("");
  const elegibles = medicamentos.filter(m => m.paciente_id === form.paciente && m.activo && !indicacionSinRevisar(m.notas));
  const seleccionado = elegibles.find(m => m.id === form.medicamento);
  function submit(e: FormEvent) {
    e.preventDefault();
    if (guardando) return;
    setError("");
    if (form.repetir && !form.dias.length) { setError("Elige al menos un día de la semana."); return; }
    if (form.tipo === "medicamento" && !seleccionado) { setError("Elige un medicamento revisado del paciente."); return; }
    guardar(async () => {
      try {
        const r = await crearTareaAgenda({ pacienteIds: form.paciente === "todos" ? pacientes.map(p => p.id) : [form.paciente], tipo: form.tipo, titulo: form.tipo === "medicamento" ? seleccionado!.medicamento_nombre : form.titulo, descripcion: form.descripcion, hora: form.hora, fecha_inicio: form.inicio, fecha_fin: form.repetir ? form.fin || null : form.inicio, dias_semana: form.repetir ? form.dias : [new Date(`${form.inicio}T12:00:00Z`).getUTCDay()], medicamento_id: form.tipo === "medicamento" ? form.medicamento : null });
        if (!r.ok || !r.tareas) { setError(r.error || "No se pudo guardar. Revisa los datos e intenta de nuevo."); return; }
        onCreated(r.tareas);
      } catch { setError("No se pudo conectar. Tus datos siguen en el formulario; intenta de nuevo."); }
    });
  }
  return <Dialogo titulo="Programar cuidado" onClose={onClose} ocupado={guardando}>
    <form onSubmit={submit} className={styles.dialogBody} aria-busy={guardando}>
      <p className={styles.helper}>Asigna una hora y cada paciente tendrá su propio seguimiento.</p>
      <fieldset disabled={guardando} className={styles.formGrid}>
        <div className={styles.full}><label htmlFor="agenda-paciente" className="label">Paciente</label><select id="agenda-paciente" className="input" required value={form.paciente} onChange={e => setForm({ ...form, paciente: e.target.value, medicamento: "" })}><option value="">Selecciona un paciente</option>{form.tipo !== "medicamento" && <option value="todos">Todos los pacientes activos</option>}{pacientes.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <div><label htmlFor="agenda-tipo" className="label">Tipo de cuidado</label><select id="agenda-tipo" className="input" value={form.tipo} onChange={e => setForm({ ...form, tipo: e.target.value as TipoAgenda, medicamento: "", paciente: e.target.value === "medicamento" && form.paciente === "todos" ? "" : form.paciente })}>{TIPOS_AGENDA.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div><label htmlFor="agenda-hora" className="label">Hora</label><input id="agenda-hora" type="time" className="input" value={form.hora} required onChange={e => setForm({ ...form, hora: e.target.value })} /></div>
        {form.tipo === "medicamento" ? <div className={styles.full}><label htmlFor="agenda-medicamento" className="label">Medicamento revisado</label><select id="agenda-medicamento" className="input" required value={form.medicamento} disabled={!form.paciente} onChange={e => setForm({ ...form, medicamento: e.target.value })}><option value="">{!form.paciente ? "Primero elige un paciente" : "Selecciona su medicamento"}</option>{elegibles.map(m => <option key={m.id} value={m.id}>{m.medicamento_nombre}{m.dosis ? ` · ${m.dosis}` : ""}</option>)}</select>{form.paciente && !elegibles.length && <p className={styles.helper}>No hay medicamentos revisados para este paciente. <Link href={`/pacientes/${form.paciente}`}>Revisar el expediente →</Link></p>}{seleccionado && <p className={styles.helper}>Dosis del expediente: {seleccionado.dosis || "Sin especificar"}. Elige únicamente el horario indicado.</p>}</div> : <div className={styles.full}><label htmlFor="agenda-titulo" className="label">¿Qué hay que hacer?</label><input id="agenda-titulo" className="input" required maxLength={120} value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} placeholder={form.tipo === "alimentacion" ? "Ej. Desayuno" : form.tipo === "terapia" ? "Ej. Terapia física" : form.tipo === "higiene" ? "Ej. Baño" : form.tipo === "visita" ? "Ej. Visita familiar" : "Nombre del cuidado"} /></div>}
        <div><label htmlFor="agenda-inicio" className="label">{form.repetir ? "A partir del" : "Fecha"}</label><input id="agenda-inicio" type="date" className="input" required min={hoy} value={form.inicio} onChange={e => setForm({ ...form, inicio: e.target.value })} /></div>
        <div className={styles.repeatField}><label><input type="checkbox" checked={form.repetir} onChange={e => setForm({ ...form, repetir: e.target.checked })} />Repetir cada semana</label></div>
        {form.repetir && <><div className={styles.full}><span className="label">Días de la semana</span><div className={styles.days} role="group" aria-label="Días de la semana">{DIAS_NUM.map(d => <button key={d.n} type="button" aria-pressed={form.dias.includes(d.n)} onClick={() => setForm({ ...form, dias: form.dias.includes(d.n) ? form.dias.filter(n => n !== d.n) : [...form.dias, d.n] })}>{d.label}</button>)}</div></div><div className={styles.full}><label htmlFor="agenda-fin" className="label">Hasta el <span className={styles.optional}>(opcional)</span></label><input id="agenda-fin" type="date" className="input" min={form.inicio || hoy} value={form.fin} onChange={e => setForm({ ...form, fin: e.target.value })} /></div></>}
        <div className={styles.full}><label htmlFor="agenda-descripcion" className="label">Indicaciones o detalles <span className={styles.optional}>(opcional)</span></label><textarea id="agenda-descripcion" className="input" rows={3} maxLength={2000} value={form.descripcion} onChange={e => setForm({ ...form, descripcion: e.target.value })} placeholder="Detalles útiles para quien realizará el cuidado" /></div>
      </fieldset>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <div className={styles.formActions}><button type="button" className="btn btn-secondary" disabled={guardando} onClick={onClose}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={guardando || (form.tipo === "medicamento" && !seleccionado)}>{guardando ? "Guardando…" : form.paciente === "todos" ? `Programar para ${pacientes.length} pacientes` : "Guardar programación"}</button></div>
    </form>
  </Dialogo>;
}
