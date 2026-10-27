import type { MedicamentoPaciente, Turno } from "./types";

/** Imported documentary records become scheduled only after an explicit review. */
export function medicamentoProgramado(medicamento: Pick<MedicamentoPaciente, "activo" | "turnos" | "notas">): boolean {
  return medicamento.activo && medicamento.turnos.length > 0 && !/requiere revisión documental/i.test(medicamento.notas ?? "");
}

export function puedeRegistrarTurno(medicamento: Pick<MedicamentoPaciente, "activo" | "turnos" | "notas">, turno: Turno): boolean {
  return medicamentoProgramado(medicamento) && medicamento.turnos.includes(turno);
}
