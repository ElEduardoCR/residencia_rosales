import type { EntradaHistorial } from "./historial";
import type { ActividadCompletada, ActividadProgramada, AdministracionMedicamento, RegistroAlimentacion, RegistroTurno } from "./types";
import type { AgendaRealizacion, AgendaTarea } from "./agenda";

type ConRegistro<T> = T & { created_at?: string; updated_at?: string };
export interface DatosHistorialPrevio {
  turnos: ConRegistro<RegistroTurno>[]; alimentacion: ConRegistro<RegistroAlimentacion>[];
  medicamentos: AdministracionMedicamento[]; actividades: ActividadProgramada[];
  completadas: ActividadCompletada[]; agenda: AgendaTarea[]; realizadas: AgendaRealizacion[];
}
function horaLocal(iso: string) { return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso)); }
function texto(...partes: (string | null | undefined)[]) { return partes.filter(Boolean).join(" · ") || null; }

/** Read existing records as recorded: never turn free text or unchecked boxes into incidents. */
export function historialPrevio(datos: DatosHistorialPrevio): EntradaHistorial[] {
  const entradas: EntradaHistorial[] = [];
  for (const r of datos.turnos) entradas.push({
    id: `anterior-turno:${r.id}`, paciente_id: r.paciente_id, tipo: "eliminacion", titulo: "Registro de eliminaciones",
    detalle: texto(`Evacuaciones: ${r.evacuaciones}. Orina: ${r.orina}`, r.notas), fecha: r.fecha, hora: null, ocurrido_at: null,
    registrado_at: r.updated_at ?? r.created_at ?? null, personal_id: r.enfermero_id, turno: r.turno, fuente: "Registro diario anterior",
  });
  const comidas = [["almuerzo", "Almuerzo"], ["comida", "Comida"], ["cena", "Cena"], ["colacion_matutina", "Colación matutina"], ["colacion_vespertina", "Colación vespertina"]] as const;
  for (const r of datos.alimentacion) {
    const marcadas = comidas.filter(([key]) => r[key]).map(([, label]) => label);
    entradas.push({ id: `anterior-comida:${r.id}`, paciente_id: r.paciente_id, tipo: "alimentacion", titulo: "Registro de alimentación",
      detalle: texto(marcadas.length ? `Comidas marcadas: ${marcadas.join(", ")}` : "Sin comidas marcadas", `Vasos de agua: ${r.vasos_agua}`, r.notas),
      fecha: r.fecha, hora: null, ocurrido_at: null, registrado_at: r.updated_at ?? r.created_at ?? null,
      personal_id: r.enfermero_id, turno: null, fuente: "Registro diario anterior" });
  }
  const administracionesPorAgenda = new Map(datos.medicamentos.filter(m => m.agenda_realizacion_id).map(m => [m.agenda_realizacion_id, m]));
  const idsRealizados = new Set(datos.realizadas.map(r => r.id));
  for (const m of datos.medicamentos) {
    if (m.agenda_realizacion_id && idsRealizados.has(m.agenda_realizacion_id)) continue;
    entradas.push({ id: `anterior-med:${m.id}`, paciente_id: m.paciente_id, tipo: "medicamento", titulo: m.medicamento_nombre,
      detalle: texto(m.dosis ? `Dosis registrada: ${m.dosis}` : null, m.tipo === "extra" ? "Medicamento extra" : null, m.motivo),
      fecha: m.fecha, hora: m.hora?.slice(0, 5) ?? null, ocurrido_at: null, registrado_at: m.created_at,
      personal_id: m.enfermero_id, turno: m.turno, fuente: "Administración registrada" });
  }
  const actividades = new Map(datos.actividades.map(a => [a.id, a]));
  for (const r of datos.completadas) {
    const a = actividades.get(r.actividad_id);
    entradas.push({ id: `anterior-actividad:${r.id}`, paciente_id: a?.paciente_id ?? null, paciente_desconocido: !a, tipo: "actividad", titulo: a?.titulo ?? "Actividad realizada",
      detalle: texto(r.notas, r.motivo_retraso ? `Motivo del retraso: ${r.motivo_retraso}` : null), fecha: r.fecha, hora: horaLocal(r.completada_at),
      ocurrido_at: r.completada_at, registrado_at: r.completada_at, personal_id: r.enfermero_id, turno: null, fuente: "Actividades anteriores" });
  }
  const tareas = new Map(datos.agenda.map(t => [t.id, t]));
  for (const r of datos.realizadas) {
    const t = tareas.get(r.tarea_id); const med = administracionesPorAgenda.get(r.id);
    entradas.push({ id: `anterior-agenda:${r.id}`, paciente_id: t?.paciente_id ?? med?.paciente_id ?? null, paciente_desconocido: !t && !med,
      tipo: t?.tipo === "medicamento" ? "medicamento" : t?.tipo === "alimentacion" ? "alimentacion" : "cuidado", titulo: t?.titulo ?? "Cuidado realizado en agenda",
      detalle: texto(med?.dosis ? `Dosis registrada: ${med.dosis}` : null, r.observaciones), fecha: r.fecha, hora: horaLocal(r.realizada_at),
      ocurrido_at: r.realizada_at, registrado_at: r.realizada_at, personal_id: r.personal_id, turno: med?.turno ?? null, fuente: "Agenda por hora" });
  }
  return entradas;
}
