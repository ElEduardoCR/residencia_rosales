"use server";

import { revalidatePath } from "next/cache";
import { getUsuarioActual } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/server";
import { indicacionSinRevisar } from "@/lib/medication-verification";
import {
  esUuidAgenda, fechaHoraAgenda, validarNuevaTareaAgenda,
  type AgendaTarea, type CrearTareaAgendaInput,
} from "@/lib/agenda";

const CAMPOS_TAREA = "id,paciente_id,tipo,titulo,descripcion,hora,fecha_inicio,fecha_fin,dias_semana,medicamento_id,activo,archivada_at,creado_por,created_at";

async function usuarioAgenda() {
  const usuario = await getUsuarioActual();
  return usuario?.personal?.activo && usuario.userId !== "local" ? usuario : null;
}
function actualizarAgenda() {
  revalidatePath("/agenda");
  revalidatePath("/turno");
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
      const { data: med, error } = await supabase.from("medicamentos_paciente").select("paciente_id,medicamento_nombre,dosis,activo,notas")
        .eq("id", v.medicamento_id!).single();
      if (error || !med?.activo || med.paciente_id !== v.pacienteIds[0] || !med.dosis?.trim() || indicacionSinRevisar(med.notas)) {
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
