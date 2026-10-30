"use server";
import { revalidatePath } from "next/cache";
import { operarTurnos } from "@/lib/turnos-server";
import { CONTEXTOS_GLUCOSA, fechaValidaTurnos, uuidTurnos, validarMedicionTurno, type CorregirEventoTurnoInput, type RegistrarEventoTurnoInput, type ResultadoTurno } from "@/lib/turnos";

function actualizar() {
  for (const path of ["/", "/turno", "/historial", "/agenda", "/medicamentos", "/administracion"]) revalidatePath(path);
  revalidatePath("/pacientes/[id]", "page");
}
function fechaHoraValida(valor: unknown) {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(valor) && Number.isFinite(Date.parse(valor));
}
function validarCampos(input: RegistrarEventoTurnoInput | CorregirEventoTurnoInput): string | null {
  if (!input || !uuidTurnos(input.solicitudId)) return "Actualiza el formulario antes de registrar.";
  if (input.detalle !== undefined && (typeof input.detalle !== "string" || input.detalle.length > 4000)) return "Las observaciones deben tener hasta 4000 caracteres.";
  if (input.ocurridoAt !== undefined && !fechaHoraValida(input.ocurridoAt)) return "Indica una fecha y hora válidas.";
  if (input.valor !== undefined && (typeof input.valor !== "number" || !Number.isFinite(input.valor))) return "Escribe un valor numérico.";
  if (input.cantidad !== undefined && input.cantidad !== null && (typeof input.cantidad !== "number" || !Number.isFinite(input.cantidad) || input.cantidad <= 0 || input.cantidad > 100000)) return "Revisa la cantidad administrada.";
  if (input.contexto !== undefined && !CONTEXTOS_GLUCOSA.some(c => c.value === input.contexto)) return "Selecciona el contexto de la glucosa.";
  return null;
}
export async function entrarAlTurno(): Promise<ResultadoTurno> {
  try {
    const result = await operarTurnos("entrar");
    if (result.error) return result;
    if (!result.sesion) return { error: "Todavía no puedes ingresar. Revisa los horarios y tu asignación con el administrador." };
    actualizar(); return { ok: true };
  } catch { return { error: "No se pudo conectar. Vuelve a intentar ingresar." }; }
}
export async function registrarEventoTurno(input: RegistrarEventoTurnoInput): Promise<ResultadoTurno> {
  try {
    const error = validarCampos(input); if (error) return { error };
    if (!uuidTurnos(input.jornadaId) || !uuidTurnos(input.pacienteId)) return { error: "Selecciona un paciente dentro del turno vigente." };
    if (!["cuidado", "incidencia", "glucosa", "cistoflo", "sueno", "medicamento"].includes(input.tipo)) return { error: "Selecciona el tipo de registro." };
    if (input.titulo !== undefined && (typeof input.titulo !== "string" || input.titulo.length > 200)) return { error: "El título debe tener hasta 200 caracteres." };
    for (const id of [input.rutinaId, input.agendaTareaId, input.medicamentoId]) if (id !== undefined && id !== null && !uuidTurnos(id)) return { error: "La actividad seleccionada no es válida." };
    if (input.agendaFecha && !fechaValidaTurnos(input.agendaFecha)) return { error: "Revisa la fecha de la actividad." };
    const medicion = validarMedicionTurno(input.tipo, input.valor, input.contexto); if (medicion) return { error: medicion };
    const result = await operarTurnos("registrar", input); if (result.ok) actualizar(); return result;
  } catch { return { error: "No se pudo conectar. Conserva el formulario y vuelve a intentarlo." }; }
}
export async function corregirEventoTurno(input: CorregirEventoTurnoInput): Promise<ResultadoTurno> {
  try {
    const error = validarCampos(input); if (error) return { error };
    if (!uuidTurnos(input.eventoId)) return { error: "Selecciona un registro del historial." };
    if (typeof input.motivo !== "string" || input.motivo.trim().length < 3 || input.motivo.length > 2000) return { error: "Explica el motivo de la corrección (entre 3 y 2000 caracteres)." };
    if (input.anulado !== undefined && typeof input.anulado !== "boolean") return { error: "Revisa el tipo de corrección." };
    const result = await operarTurnos("corregir", input, true); if (result.ok) actualizar(); return result;
  } catch { return { error: "No se pudo conectar. La corrección todavía no se ha confirmado." }; }
}
