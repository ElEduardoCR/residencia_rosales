import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/server";
import { tareaOcurreEnFecha, type AgendaTarea } from "@/lib/agenda";
import { fechaTurnos, isoDesdeFechaHoraTurnos, type AdministracionTurnosData, type EventoTurno, type MedicamentoTurno, type PacienteTurno, type RutinaTurno, type TareaTurno, type TurnoData } from "@/lib/turnos";

const MEDICAMENTOS = "id,paciente_id,medicamento_nombre,dosis,presentacion,cantidad,stock_verificado_at,activo,notas,turnos";
function truncado(result: { count?: number | null; data: unknown }): boolean { return typeof result.count === "number" && Array.isArray(result.data) && result.count > result.data.length; }

const PACIENTES = "id,nombre,foto_url,tiene_cistoflo,activo";

export function mensajeErrorTurnos(message?: string): string {
  if (message?.startsWith("TURNO: ")) return message.slice(7);
  return "No se pudo guardar. Actualiza la página y vuelve a intentarlo.";
}

export async function operarTurnos(operacion: string, datos: object = {}, admin = false) {
  const usuario = await getUsuarioActual();
  if (!usuario?.personal?.activo || usuario.userId === "local") return { error: "Inicia sesión con tu cuenta de personal para registrar." };
  if (admin && !usuario.esAdmin) return { error: "Esta operación corresponde al administrador." };
  const supabase = await createAuthClient();
  const { data, error } = await supabase.rpc("turnos_operar", { p_operacion: operacion, p_datos: datos });
  if (error) return { error: mensajeErrorTurnos(error.message) };
  return data as { ok?: boolean; error?: string; evento?: EventoTurno; sesion?: boolean };
}

export async function cargarTurnoData(): Promise<TurnoData> {
  const usuario = await getUsuarioActual();
  if (!usuario?.personal || usuario.userId === "local") redirect("/login");
  const supabase = await createAuthClient();
  const result: TurnoData = {
    usuario: { id: usuario.personal.id, nombre: usuario.nombre, esAdmin: usuario.esAdmin, turno: usuario.personal.turno },
    contexto: { configurada: false, puedeEntrar: false, motivo: null, ventana: null, sesion: false },
    pacientes: [], tareas: [], eventos: [], medicamentos: [], personal: [], ahora: new Date().toISOString(),
  };
  const [contexto, pacientes, personal, medicamentos] = await Promise.all([
    supabase.rpc("turnos_operar", { p_operacion: "contexto", p_datos: {} }),
    supabase.from("pacientes").select(PACIENTES, { count: "exact" }).order("nombre"),
    supabase.from("personal").select("id,nombre", { count: "exact" }).order("nombre"),
    supabase.from("medicamentos_paciente").select(MEDICAMENTOS, { count: "exact" }).eq("activo", true).order("medicamento_nombre"),
  ]);
  if ([contexto, pacientes, personal, medicamentos].some(r => r.error || truncado(r))) {
    result.error = "No se pudo cargar el turno. Actualiza la página; si continúa, avisa al administrador.";
    return result;
  }
  result.contexto = contexto.data as TurnoData["contexto"];
  result.pacientes = pacientes.data as PacienteTurno[];
  result.personal = personal.data ?? [];
  result.medicamentos = medicamentos.data as MedicamentoTurno[];
  const ventana = result.contexto.ventana;
  if (!ventana) return result;
  const fechas = [...new Set([fechaTurnos(ventana.inicio), fechaTurnos(new Date(new Date(ventana.fin).getTime() - 1))])];
  const [rutinas, agenda, realizaciones, eventos] = await Promise.all([
    supabase.from("turnos_rutinas").select("*", { count: "exact" }).eq("activo", true).eq("turno", ventana.turno),
    supabase.from("agenda_tareas").select("*", { count: "exact" }).eq("activo", true).lte("fecha_inicio", fechas.at(-1)!),
    supabase.from("agenda_realizaciones").select("tarea_id,fecha,personal_id,turno_evento_id", { count: "exact" }).in("fecha", fechas),
    ventana.id ? supabase.from("turnos_eventos").select("*", { count: "exact" }).eq("jornada_id", ventana.id).order("registrado_at") : Promise.resolve({ data: [], error: null }),
  ]);
  if ([rutinas, agenda, realizaciones, eventos].some(r => r.error || truncado(r))) {
    result.error = "No se pudieron cargar las actividades del turno. Actualiza antes de registrar.";
    return result;
  }
  result.eventos = (eventos.data ?? []) as EventoTurno[];
  const nombres = new Map(result.personal.map(persona => [persona.id, persona.nombre]));
  const dia = new Date(`${ventana.fecha}T12:00:00Z`).getUTCDay();
  const tareas: TareaTurno[] = [];
  for (const rutina of (rutinas.data ?? []) as RutinaTurno[]) {
    if (!rutina.dias_semana.includes(dia)) continue;
    for (const paciente of result.pacientes.filter(p => p.activo && (!rutina.paciente_id || rutina.paciente_id === p.id))) {
      const original = result.eventos.find(e => !e.corrige_id && e.rutina_id === rutina.id && e.paciente_id === paciente.id);
      const ultima = original ? result.eventos.find(e => e.raiz_id === original.id && !result.eventos.some(c => c.corrige_id === e.id)) : null;
      tareas.push({ clave: `rutina:${rutina.id}:${paciente.id}`, paciente_id: paciente.id, titulo: rutina.titulo, detalle: rutina.detalle, tipo: "cuidado", rutina_id: rutina.id, agenda_tarea_id: null, agenda_fecha: null, medicamento_id: null, hora: null, realizada: !!original && !ultima?.anulado, anulada: !!ultima?.anulado, evento_id: ultima?.id ?? original?.id ?? null, autor: original ? nombres.get(original.personal_id) ?? "Personal" : null });
    }
  }
  for (const actividad of (agenda.data ?? []) as AgendaTarea[]) {
    if (!result.pacientes.some(p => p.id === actividad.paciente_id && p.activo)) continue;
    for (const fecha of fechas) {
      if (!tareaOcurreEnFecha(actividad, fecha)) continue;
      const hora = isoDesdeFechaHoraTurnos(fecha, actividad.hora);
      if (!hora || Date.parse(hora) < Date.parse(ventana.inicio) || Date.parse(hora) >= Date.parse(ventana.fin)) continue;
      const realizada = realizaciones.data?.find(r => r.tarea_id === actividad.id && r.fecha === fecha);
      const original = result.eventos.find(e => e.id === realizada?.turno_evento_id);
      const ultima = original ? result.eventos.find(e => e.raiz_id === original.id && !result.eventos.some(c => c.corrige_id === e.id)) : null;
      tareas.push({ clave: `agenda:${actividad.id}:${fecha}`, paciente_id: actividad.paciente_id, titulo: actividad.titulo, detalle: actividad.descripcion, tipo: actividad.tipo === "medicamento" ? "medicamento" : "cuidado", rutina_id: null, agenda_tarea_id: actividad.id, agenda_fecha: fecha, medicamento_id: actividad.medicamento_id, hora, realizada: !!realizada && !ultima?.anulado, anulada: !!ultima?.anulado, evento_id: ultima?.id ?? realizada?.turno_evento_id ?? null, autor: realizada ? nombres.get(realizada.personal_id) ?? "Personal" : null });
    }
  }
  for (const medicamento of result.medicamentos) {
    if (!medicamento.turnos?.includes(ventana.turno) || !result.pacientes.some(p => p.id === medicamento.paciente_id && p.activo) || tareas.some(t => t.medicamento_id === medicamento.id)) continue;
    const original = result.eventos.find(e => !e.corrige_id && e.medicamento_id === medicamento.id);
    const ultima = original ? result.eventos.find(e => e.raiz_id === original.id && !result.eventos.some(c => c.corrige_id === e.id)) : null;
    tareas.push({ clave: `medicamento:${medicamento.id}`, paciente_id: medicamento.paciente_id, titulo: medicamento.medicamento_nombre, detalle: medicamento.dosis, tipo: "medicamento", rutina_id: null, agenda_tarea_id: null, agenda_fecha: null, medicamento_id: medicamento.id, hora: null, realizada: !!original && !ultima?.anulado, anulada: !!ultima?.anulado, evento_id: ultima?.id ?? original?.id ?? null, autor: original ? nombres.get(original.personal_id) ?? "Personal" : null });
  }
  result.tareas = tareas.sort((a, b) => (a.hora ?? "").localeCompare(b.hora ?? "") || a.titulo.localeCompare(b.titulo, "es"));
  return result;
}

export async function cargarAdministracionTurnos(): Promise<AdministracionTurnosData> {
  const usuario = await getUsuarioActual();
  if (!usuario?.personal || usuario.userId === "local") redirect("/login");
  if (!usuario.esAdmin) redirect("/turno");
  const supabase = await createAuthClient();
  const [horarios, rutinas, personal, pacientes, medicamentos] = await Promise.all([
    supabase.from("turnos_horarios").select("*", { count: "exact" }).order("vigente_desde", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("turnos_rutinas").select("*", { count: "exact" }).order("created_at", { ascending: false }),
    supabase.from("personal").select("id,nombre,turno,activo", { count: "exact" }).order("nombre"),
    supabase.from("pacientes").select(PACIENTES, { count: "exact" }).order("nombre"),
    supabase.from("medicamentos_paciente").select(MEDICAMENTOS, { count: "exact" }).eq("activo", true).order("medicamento_nombre"),
  ]);
  if ([horarios, rutinas, personal, pacientes, medicamentos].some(r => r.error || truncado(r))) return { horarios: [], rutinas: [], personal: [], pacientes: [], medicamentos: [], hoy: fechaTurnos(), error: "No se pudo cargar la configuración. Actualiza antes de cambiar los turnos." };
  return { horarios: horarios.data ?? [], rutinas: rutinas.data ?? [], personal: personal.data ?? [], pacientes: (pacientes.data ?? []) as PacienteTurno[], medicamentos: (medicamentos.data ?? []) as MedicamentoTurno[], hoy: fechaTurnos() };
}
