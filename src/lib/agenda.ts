/** Shared date logic always uses the residence timezone, never the browser timezone. */
export const ZONA_AGENDA = "America/Mexico_City";
export const TIPOS_AGENDA = [
  { value: "medicamento", label: "Medicamento" },
  { value: "alimentacion", label: "Alimentación" },
  { value: "terapia", label: "Terapia física" },
  { value: "higiene", label: "Baño e higiene" },
  { value: "visita", label: "Visita" },
  { value: "otro", label: "Otro cuidado" },
] as const;
export type TipoAgenda = typeof TIPOS_AGENDA[number]["value"];
export interface AgendaPersona { id: string; nombre: string; activo?: boolean }
export interface AgendaMedicamento {
  id: string; paciente_id: string; medicamento_nombre: string; dosis: string | null;
  activo: boolean; notas: string | null;
}
export interface AgendaTarea {
  id: string; paciente_id: string; tipo: TipoAgenda; titulo: string; descripcion: string | null;
  hora: string; fecha_inicio: string; fecha_fin: string | null; dias_semana: number[];
  medicamento_id: string | null; activo: boolean; archivada_at: string | null;
  creado_por: string | null; created_at: string;
}
export interface AgendaRealizacion {
  id: string; tarea_id: string; fecha: string; realizada_at: string;
  personal_id: string; observaciones: string | null; corregida?: boolean;
}
export interface CrearTareaAgendaInput {
  pacienteIds: string[]; tipo: TipoAgenda; titulo: string; descripcion?: string;
  hora: string; fecha_inicio: string; fecha_fin?: string | null;
  dias_semana: number[]; medicamento_id?: string | null;
}

export function fechaAgendaValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const parsed = new Date(`${valor}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === valor;
}
export function fechaHoraAgenda(ahora: Date | string = new Date()): { fecha: string; minutos: number } {
  const date = typeof ahora === "string" ? new Date(ahora) : ahora;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_AGENDA, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? "";
  return { fecha: `${get("year")}-${get("month")}-${get("day")}`, minutos: Number(get("hour")) * 60 + Number(get("minute")) };
}
export function minutosAgenda(hora: string): number {
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(hora)) return Number.NaN;
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}
export function tareaOcurreEnFecha(tarea: AgendaTarea, fecha: string): boolean {
  if (!fechaAgendaValida(fecha) || fecha < tarea.fecha_inicio || (tarea.fecha_fin && fecha > tarea.fecha_fin)) return false;
  if (tarea.archivada_at && fecha > fechaHoraAgenda(tarea.archivada_at).fecha) return false;
  return tarea.dias_semana.includes(new Date(`${fecha}T12:00:00Z`).getUTCDay());
}
export function estadoTareaAgenda(
  tarea: AgendaTarea, fecha: string, realizacion: AgendaRealizacion | null | undefined, ahora: string,
): "completada" | "pendiente" | "vencida" {
  if (realizacion?.tarea_id === tarea.id && realizacion.fecha === fecha) return "completada";
  const hoy = fechaHoraAgenda(ahora);
  return fecha < hoy.fecha || (fecha === hoy.fecha && minutosAgenda(tarea.hora) < hoy.minutos) ? "vencida" : "pendiente";
}
export function esUuidAgenda(valor: unknown): valor is string {
  return typeof valor === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
}

/** Untrusted action input: validate before any database access. */
export function validarNuevaTareaAgenda(input: unknown, hoy: string): { value?: CrearTareaAgendaInput; error?: string } {
  if (!input || typeof input !== "object") return { error: "Revisa los datos de la tarea." };
  const v = input as Record<string, unknown>;
  if (!Array.isArray(v.pacienteIds) || !v.pacienteIds.length || v.pacienteIds.length > 100 || !v.pacienteIds.every(esUuidAgenda)) return { error: "Selecciona al menos un paciente." };
  if (!TIPOS_AGENDA.some(t => t.value === v.tipo)) return { error: "Selecciona el tipo de cuidado." };
  if (typeof v.titulo !== "string" || !v.titulo.trim() || v.titulo.trim().length > 120) return { error: "Escribe un título de hasta 120 caracteres." };
  if (v.descripcion !== undefined && (typeof v.descripcion !== "string" || v.descripcion.length > 2000)) return { error: "Las indicaciones deben tener hasta 2000 caracteres." };
  if (typeof v.hora !== "string" || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v.hora)) return { error: "Indica una hora válida." };
  if (!fechaAgendaValida(v.fecha_inicio) || v.fecha_inicio < hoy) return { error: "La programación debe comenzar hoy o después." };
  if (v.fecha_fin !== undefined && v.fecha_fin !== null && v.fecha_fin !== "" && (!fechaAgendaValida(v.fecha_fin) || v.fecha_fin < v.fecha_inicio)) return { error: "La fecha final debe ser igual o posterior al inicio." };
  if (!Array.isArray(v.dias_semana) || !v.dias_semana.length || v.dias_semana.length > 7 || !v.dias_semana.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) return { error: "Selecciona los días de la semana." };
  const pacienteIds = [...new Set(v.pacienteIds as string[])];
  if (v.tipo === "medicamento" && (pacienteIds.length !== 1 || !esUuidAgenda(v.medicamento_id))) return { error: "Selecciona un paciente y su medicamento revisado." };
  if (v.tipo !== "medicamento" && v.medicamento_id) return { error: "Solo las tareas de medicamento pueden vincular una indicación." };
  const dias = [...new Set(v.dias_semana as number[])].sort();
  if (v.fecha_fin) {
    const inicio = new Date(`${v.fecha_inicio}T12:00:00Z`);
    let hayOcurrencia = false;
    for (let i = 0; i < 7; i++) {
      const d = new Date(inicio); d.setUTCDate(d.getUTCDate() + i);
      if (d.toISOString().slice(0, 10) > v.fecha_fin) break;
      if (dias.includes(d.getUTCDay())) { hayOcurrencia = true; break; }
    }
    if (!hayOcurrencia) return { error: "Elige un día de la semana dentro de las fechas indicadas." };
  }
  return { value: {
    pacienteIds, tipo: v.tipo as TipoAgenda, titulo: v.titulo.trim(), descripcion: (v.descripcion as string | undefined)?.trim(),
    hora: v.hora, fecha_inicio: v.fecha_inicio, fecha_fin: (v.fecha_fin as string | null) || null,
    dias_semana: dias, medicamento_id: (v.medicamento_id as string | null) || null,
  } };
}
