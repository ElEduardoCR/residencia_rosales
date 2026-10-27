"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioActual } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/server";
import { indicacionSinRevisar } from "@/lib/medication-verification";
import {
  esUuidAgenda, fechaAgendaValida, fechaHoraAgenda, tareaOcurreEnFecha, validarNuevaTareaAgenda,
  type AgendaRealizacion, type AgendaTarea, type CrearTareaAgendaInput,
} from "@/lib/agenda";

const CAMPOS_TAREA = "id,paciente_id,tipo,titulo,descripcion,hora,fecha_inicio,fecha_fin,dias_semana,medicamento_id,activo,archivada_at,creado_por,created_at";
const CAMPOS_REALIZACION = "id,tarea_id,fecha,realizada_at,personal_id,observaciones";

async function usuarioAgenda() {
  const usuario = await getUsuarioActual();
  return usuario?.personal?.activo && usuario.userId !== "local" ? usuario : null;
}
function actualizarAgenda() {
  revalidatePath("/agenda");
  revalidatePath("/");
}

export async function crearTareaAgenda(input: CrearTareaAgendaInput): Promise<{ ok?: boolean; tareas?: AgendaTarea[]; error?: string }> {
  try {
    const usuario = await usuarioAgenda();
    if (!usuario?.esAdmin) return { error: "Inicia sesión como administrador para programar cuidados." };
    const validado = validarNuevaTareaAgenda(input, fechaHoraAgenda().fecha);
    if (!validado.value) return { error: validado.error };
    const v = validado.value;
    const supabase = await createAuthClient();
    const { data: pacientes, error: pacientesError } = await supabase.from("pacientes").select("id").in("id", v.pacienteIds).eq("activo", true);
    if (pacientesError || pacientes?.length !== v.pacienteIds.length) return { error: "Algún paciente ya no está activo. Actualiza la agenda antes de programar." };
    let titulo = v.titulo;
    if (v.tipo === "medicamento") {
      const { data: med, error } = await supabase.from("medicamentos_paciente").select("paciente_id,medicamento_nombre,activo,notas")
        .eq("id", v.medicamento_id!).single();
      if (error || !med?.activo || med.paciente_id !== v.pacienteIds[0] || indicacionSinRevisar(med.notas)) {
        return { error: "Revisa y confirma la indicación del medicamento en el expediente antes de programarlo." };
      }
      titulo = med.medicamento_nombre;
    }
    const filas = v.pacienteIds.map(paciente_id => ({
      paciente_id, tipo: v.tipo, titulo, descripcion: v.descripcion || null, hora: v.hora,
      fecha_inicio: v.fecha_inicio, fecha_fin: v.fecha_fin || null, dias_semana: v.dias_semana,
      medicamento_id: v.medicamento_id || null, creado_por: usuario.personal!.id,
    }));
    const { data, error } = await supabase.from("agenda_tareas").insert(filas).select(CAMPOS_TAREA);
    if (error || !data?.length) return { error: error?.code === "23505" ? "Ya hay una tarea igual para ese paciente y horario." : "No se pudo guardar la tarea. Tus datos siguen en el formulario." };
    actualizarAgenda();
    return { ok: true, tareas: data as AgendaTarea[] };
  } catch {
    return { error: "No se pudo conectar. Vuelve a intentarlo sin cerrar el formulario." };
  }
}

export async function realizarTareaAgenda(input: { tareaId: string; fecha: string; observaciones?: string }): Promise<{ ok?: boolean; realizacion?: AgendaRealizacion; yaRegistrada?: boolean; error?: string }> {
  try {
    const usuario = await usuarioAgenda();
    if (!usuario) return { error: "Inicia sesión con tu cuenta para registrar quién realizó la tarea." };
    if (!input || !esUuidAgenda(input.tareaId) || !fechaAgendaValida(input.fecha)
      || (input.observaciones !== undefined && (typeof input.observaciones !== "string" || input.observaciones.length > 1000))) return { error: "Revisa la fecha y las observaciones de la tarea." };
    if (input.fecha > fechaHoraAgenda().fecha) return { error: "No puedes marcar como realizada una tarea de un día futuro." };
    const supabase = await createAuthClient();
    const existente = () => supabase.from("agenda_realizaciones").select(CAMPOS_REALIZACION).eq("tarea_id", input.tareaId).eq("fecha", input.fecha).maybeSingle();
    const anterior = await existente();
    if (anterior.error) return { error: "No se pudo comprobar si esta tarea ya se realizó. Actualiza antes de volver a marcar." };
    if (anterior.data) return { ok: true, realizacion: anterior.data as AgendaRealizacion, yaRegistrada: true };
    const { data: tarea, error: tareaError } = await supabase.from("agenda_tareas").select(CAMPOS_TAREA).eq("id", input.tareaId).single();
    if (tareaError || !tarea?.activo || !tareaOcurreEnFecha(tarea as AgendaTarea, input.fecha)) return { error: "La tarea no está programada para esa fecha o fue archivada. Actualiza la agenda." };
    if (tarea.medicamento_id) {
      const { data: med, error } = await supabase.from("medicamentos_paciente").select("paciente_id,activo,notas").eq("id", tarea.medicamento_id).single();
      if (error || !med?.activo || med.paciente_id !== tarea.paciente_id || indicacionSinRevisar(med.notas)) return { error: "La indicación del medicamento requiere revisión antes de registrar su administración." };
    }
    const { data, error } = await supabase.from("agenda_realizaciones").insert({
      tarea_id: input.tareaId, fecha: input.fecha, personal_id: usuario.personal!.id,
      observaciones: input.observaciones?.trim() || null,
    }).select(CAMPOS_REALIZACION).single();
    if (error?.code === "23505") {
      const otra = await existente();
      if (!otra.error && otra.data) { actualizarAgenda(); return { ok: true, realizacion: otra.data as AgendaRealizacion, yaRegistrada: true }; }
    }
    if (error || !data) return { error: "No se pudo registrar. La tarea puede haber cambiado; actualiza la agenda e inténtalo otra vez." };
    actualizarAgenda();
    if (tarea.tipo === "medicamento") revalidatePath(`/pacientes/${tarea.paciente_id}`);
    return { ok: true, realizacion: data as AgendaRealizacion };
  } catch {
    return { error: "No se pudo conectar. Actualiza la agenda para comprobar si se guardó antes de volver a marcar." };
  }
}

export async function desactivarTareaAgenda(input: { tareaId: string }): Promise<{ ok?: boolean; archivada_at?: string; error?: string }> {
  try {
    const usuario = await usuarioAgenda();
    if (!usuario?.esAdmin) return { error: "Solo el administrador puede archivar tareas." };
    if (!input || !esUuidAgenda(input.tareaId)) return { error: "Selecciona una tarea válida." };
    const supabase = await createAuthClient();
    const { data, error } = await supabase.from("agenda_tareas").update({ activo: false }).eq("id", input.tareaId).select("id,archivada_at").single();
    if (error || !data) return { error: "No se pudo archivar la tarea. Actualiza e inténtalo otra vez." };
    actualizarAgenda();
    return { ok: true, archivada_at: data.archivada_at };
  } catch {
    return { error: "No se pudo conectar. La tarea sigue en la agenda." };
  }
}
