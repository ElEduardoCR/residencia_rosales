"use server";
import { revalidatePath } from "next/cache";
import { operarTurnos } from "@/lib/turnos-server";
import { TURNOS_NOMBRES, uuidTurnos, validarHorariosTurno, type TurnoNombre } from "@/lib/turnos";

async function guardar(operacion: string, datos: object): Promise<{ ok?: boolean; error?: string }> {
  try {
    const result = await operarTurnos(operacion, datos, true);
    if (result.ok) for (const path of ["/administracion", "/medicamentos", "/turno", "/historial", "/agenda", "/"]) revalidatePath(path);
    return result;
  } catch { return { error: "No se pudo conectar. Revisa los datos y vuelve a intentarlo." }; }
}
export async function guardarHorariosTurno(input: { matutino: string; vespertino: string; nocturno: string; vigenteDesde: string }) {
  if (!input || [input.matutino, input.vespertino, input.nocturno].some(v => typeof v !== "string")) return { error: "Escribe las horas de los tres turnos." };
  const error = validarHorariosTurno(input); if (error) return { error };
  return guardar("horarios", input);
}
export async function guardarRutinaTurno(input: { pacienteId?: string | null; turno: TurnoNombre; titulo: string; detalle?: string; diasSemana: number[] }) {
  if (!input || (input.pacienteId && !uuidTurnos(input.pacienteId)) || !TURNOS_NOMBRES.some(t => t.value === input.turno)) return { error: "Selecciona el turno y los pacientes de la rutina." };
  if (typeof input.titulo !== "string" || !input.titulo.trim() || input.titulo.trim().length > 120 || (input.detalle !== undefined && (typeof input.detalle !== "string" || input.detalle.length > 2000))) return { error: "Escribe un título de hasta 120 caracteres e indicaciones de hasta 2000." };
  if (!Array.isArray(input.diasSemana) || !input.diasSemana.length || input.diasSemana.length > 7 || !input.diasSemana.every(d => Number.isInteger(d) && d >= 0 && d <= 6)) return { error: "Selecciona los días de la semana." };
  return guardar("rutina", input);
}
export async function archivarRutinaTurno(input: { rutinaId: string }) {
  if (!input || !uuidTurnos(input.rutinaId)) return { error: "Selecciona una rutina." }; return guardar("archivar_rutina", input);
}
export async function actualizarAsignacionTurno(input: { personalId: string; turno: TurnoNombre | "mixto" | null }) {
  if (!input || !uuidTurnos(input.personalId) || (input.turno !== null && input.turno !== "mixto" && !TURNOS_NOMBRES.some(t => t.value === input.turno))) return { error: "Selecciona al personal y su turno." }; return guardar("asignacion", input);
}
export async function actualizarCistofloPaciente(input: { pacienteId: string; tieneCistoflo: boolean }) {
  if (!input || !uuidTurnos(input.pacienteId) || typeof input.tieneCistoflo !== "boolean") return { error: "Selecciona al paciente e indica si utiliza Cistoflo." }; return guardar("cistoflo", input);
}
export async function contarMedicamentoTurno(input: { medicamentoId: string; cantidad: number; cantidadEsperada: number; motivo: string }) {
  if (!input || !uuidTurnos(input.medicamentoId) || typeof input.cantidad !== "number" || !Number.isFinite(input.cantidad) || input.cantidad < 0 || input.cantidad > 1e9 || typeof input.cantidadEsperada !== "number" || !Number.isFinite(input.cantidadEsperada)) return { error: "Escribe la cantidad contada y actualiza las existencias antes de guardar." };
  if (typeof input.motivo !== "string" || input.motivo.trim().length < 3 || input.motivo.length > 2000) return { error: "Explica el motivo del conteo (entre 3 y 2000 caracteres)." };
  return guardar("conteo", input);
}
