import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { fechaAgendaValida, fechaHoraAgenda, tareaOcurreEnFecha, type AgendaTarea } from "@/lib/agenda";
import AgendaCliente from "@/components/AgendaCliente";

export const dynamic = "force-dynamic";

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ fecha?: string | string[] }> }) {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.userId === "local") redirect("/login");
  const params = await searchParams;
  const ahora = new Date().toISOString();
  const hoy = fechaHoraAgenda(ahora).fecha;
  const fecha = fechaAgendaValida(params.fecha) ? params.fecha : hoy;
  const supabase = await createAuthClient();
  const [pacientes, personal, tareas, realizadas, medicamentos] = await Promise.all([
    supabase.from("pacientes").select("id,nombre,activo", { count: "exact" }).order("nombre").limit(1000),
    supabase.from("personal").select("id,nombre", { count: "exact" }).order("nombre").limit(1000),
    supabase.from("agenda_tareas").select("*", { count: "exact" }).lte("fecha_inicio", fecha).or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`).order("hora").limit(1000),
    supabase.from("agenda_realizaciones").select("id,tarea_id,fecha,realizada_at,personal_id,observaciones", { count: "exact" }).eq("fecha", fecha).limit(1000),
    supabase.from("medicamentos_paciente").select("id,paciente_id,medicamento_nombre,dosis,activo,notas", { count: "exact" }).eq("activo", true).order("medicamento_nombre").limit(1000),
  ]);
  const fallo = [pacientes, personal, tareas, realizadas, medicamentos].some(result => result.error || result.count === null || result.count > 1000);
  const idsRealizados = new Set((realizadas.data ?? []).map(r => r.tarea_id));
  // Archived tasks stay visible in their historical dates, including every completed occurrence.
  const delDia = (tareas.data ?? []).filter(t => tareaOcurreEnFecha(t as AgendaTarea, fecha) || idsRealizados.has(t.id));
  const pacientesDelDia = new Set(delDia.map(t => t.paciente_id));
  const filasPacientes = (pacientes.data ?? []).filter(p => p.activo || pacientesDelDia.has(p.id));
  return <AgendaCliente key={fecha}
    pacientes={filasPacientes} personal={personal.data ?? []} tareas={delDia}
    realizaciones={realizadas.data ?? []} medicamentos={medicamentos.data ?? []}
    fecha={fecha} hoy={hoy} ahora={ahora} esAdmin={usuario.esAdmin} miPersonalId={usuario.personal?.id ?? null}
    errorCarga={fallo ? "No se pudo cargar la agenda completa. Actualiza la página antes de registrar cambios." : undefined}
  />;
}
