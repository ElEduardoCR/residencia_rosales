import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { fechaValidaTurnos, uuidTurnos, type EventoTurno } from "@/lib/turnos";
import { fechaHistorial, historialDeEventos, rangoMesHistorial, sumarDiasHistorial, type EntradaHistorial, type FiltrosHistorial, type JornadaHistorial } from "@/lib/historial";
import { historialPrevio, type DatosHistorialPrevio } from "@/lib/historial-legacy";
import HistorialCliente from "@/components/HistorialCliente";

export const dynamic = "force-dynamic";
type Persona = { id: string; nombre: string; activo?: boolean };
type Respuesta<T> = { data: T[] | null; error: { message: string } | null; count: number | null };

/** Supabase defaults to 1,000 rows. Never compute clinical summaries from a truncated page. */
async function leerTodo<T>(consultar: (desde: number, hasta: number) => PromiseLike<Respuesta<T>>): Promise<T[]> {
  const filas: T[] = [];
  for (let offset = 0; ;) {
    const result = await consultar(offset, offset + 999);
    if (result.error || result.count == null) throw new Error("No se pudo consultar el historial completo. Actualiza la página para volver a intentarlo.");
    if (result.count > 30000) throw new Error("Hay demasiados registros para este rango. Elige menos días o un solo paciente.");
    filas.push(...(result.data ?? []));
    if (filas.length >= result.count) return filas;
    if (!result.data?.length) throw new Error("La consulta quedó incompleta. Actualiza la página.");
    offset += result.data.length;
  }
}

export default async function HistorialPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.userId === "local") redirect("/login");
  const params = await searchParams;
  const str = (nombre: string) => typeof params[nombre] === "string" ? params[nombre] as string : "";
  const hoy = fechaHistorial(new Date().toISOString());
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(str("mes")) && fechaValidaTurnos(`${str("mes")}-01`) ? rangoMesHistorial(str("mes")) : null;
  const desde = mes?.desde ?? (fechaValidaTurnos(str("desde")) ? str("desde") : sumarDiasHistorial(hoy, -29));
  const hasta = mes?.hasta ?? (fechaValidaTurnos(str("hasta")) ? str("hasta") : hoy);
  const filtros: FiltrosHistorial = { desde, hasta, paciente: uuidTurnos(str("paciente")) ? str("paciente") : "", tipo: str("tipo"), turno: str("turno"), texto: str("q").slice(0, 200) };
  const supabase = await createAuthClient();
  let pacientes: Persona[] = []; let personal: Persona[] = []; let entradas: EntradaHistorial[] = []; let error: string | undefined;
  try {
    [pacientes, personal] = await Promise.all([
      leerTodo<Persona>((a, b) => supabase.from("pacientes").select("id,nombre,activo", { count: "exact" }).order("id").range(a, b)),
      leerTodo<Persona>((a, b) => supabase.from("personal").select("id,nombre", { count: "exact" }).order("id").range(a, b)),
    ]);
    if (desde > hasta) throw new Error("La fecha inicial debe ser anterior o igual a la fecha final.");
    if (sumarDiasHistorial(desde, 366) < hasta) throw new Error("Elige un rango de hasta un año para consultar el historial.");
    const anteriores = <T,>(tabla: string, filtrarPaciente = true) => leerTodo<T>((a, b) => {
      let query = supabase.from(tabla).select("*", { count: "exact" }).gte("fecha", desde).lte("fecha", hasta);
      if (filtrarPaciente && filtros.paciente) query = query.eq("paciente_id", filtros.paciente);
      if (["administracion_medicamentos", "agenda_realizaciones"].includes(tabla)) query = query.is("turno_evento_id", null);
      return query.order("id").range(a, b);
    });
    const [eventosRango, turnos, alimentacion, medicamentos, completadas, realizadas] = await Promise.all([
      leerTodo<EventoTurno>((a, b) => {
        // A broad UTC window is narrowed to residence-local calendar dates after reading full chains.
        let q = supabase.from("turnos_eventos").select("*", { count: "exact" }).gte("ocurrido_at", `${desde}T00:00:00Z`).lt("ocurrido_at", `${sumarDiasHistorial(hasta, 2)}T00:00:00Z`);
        if (filtros.paciente) q = q.eq("paciente_id", filtros.paciente);
        return q.order("id").range(a, b);
      }),
      anteriores<DatosHistorialPrevio["turnos"][number]>("registros_turno"),
      anteriores<DatosHistorialPrevio["alimentacion"][number]>("registros_alimentacion"),
      anteriores<DatosHistorialPrevio["medicamentos"][number]>("administracion_medicamentos"),
      anteriores<DatosHistorialPrevio["completadas"][number]>("actividades_completadas", false),
      anteriores<DatosHistorialPrevio["realizadas"][number]>("agenda_realizaciones", false),
    ]);
    async function porIds<T>(tabla: string, columna: string, ids: string[]): Promise<T[]> {
      const unicos = [...new Set(ids)]; const filas: T[] = [];
      for (let i = 0; i < unicos.length; i += 100) filas.push(...await leerTodo<T>((a, b) => supabase.from(tabla).select("*", { count: "exact" }).in(columna, unicos.slice(i, i + 100)).order("id").range(a, b)));
      return filas;
    }
    const [eventos, actividades, agenda] = await Promise.all([
      porIds<EventoTurno>("turnos_eventos", "raiz_id", eventosRango.map(e => e.raiz_id)),
      porIds<DatosHistorialPrevio["actividades"][number]>("actividades_programadas", "id", completadas.map(e => e.actividad_id)),
      porIds<DatosHistorialPrevio["agenda"][number]>("agenda_tareas", "id", realizadas.map(e => e.tarea_id)),
    ]);
    const jornadas = await porIds<JornadaHistorial>("turnos_jornadas", "id", eventos.map(e => e.jornada_id));
    entradas = [...historialDeEventos(eventos, jornadas), ...historialPrevio({ turnos, alimentacion, medicamentos, completadas, realizadas, actividades, agenda })];
  } catch (e) { error = e instanceof Error ? e.message : "No se pudo cargar el historial completo."; }
  pacientes.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  return <HistorialCliente key={JSON.stringify(filtros)} entradas={entradas} pacientes={pacientes} personal={personal} filtrosIniciales={filtros} hoy={hoy} esAdmin={usuario.esAdmin} errorCarga={error} />;
}
