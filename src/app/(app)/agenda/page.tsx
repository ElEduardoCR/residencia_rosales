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
  const [pacientes, personal, tareas, realizadas, medicamentos, vigentes] = await Promise.all([
    supabase.from("pacientes").select("id,nombre,activo", { count: "exact" }).order("nombre").limit(1000),
    supabase.from("personal").select("id,nombre", { count: "exact" }).order("nombre").limit(1000),
    supabase.from("agenda_tareas").select("*", { count: "exact" }).lte("fecha_inicio", fecha).or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`).order("hora").limit(1000),
    supabase.from("agenda_realizaciones").select("id,tarea_id,fecha,realizada_at,personal_id,observaciones,turno_evento_id", { count: "exact" }).eq("fecha", fecha).limit(1000),
    supabase.from("medicamentos_paciente").select("id,paciente_id,medicamento_nombre,dosis,activo,notas", { count: "exact" }).eq("activo", true).order("medicamento_nombre").limit(1000),
    supabase.from("turnos_eventos_vigentes").select("raiz_id,ocurrido_at,detalle,corrige_id", { count: "exact" }).eq("agenda_fecha", fecha).limit(1000),
  ]);
  const fallo = [pacientes, personal, tareas, realizadas, medicamentos, vigentes].some(result => result.error || result.count === null || result.count > 1000);
  const porOriginal = new Map((vigentes.data ?? []).map(e => [e.raiz_id, e]));
  const realizacionesActuales = (realizadas.data ?? []).flatMap(r => {
    if (!r.turno_evento_id) return [r];
    const vigente = porOriginal.get(r.turno_evento_id);
    if (!vigente) return [];
    return [{ ...r, realizada_at: vigente.ocurrido_at, observaciones: vigente.detalle, corregida: Boolean(vigente.corrige_id) }];
  });
  const idsRealizados = new Set((realizadas.data ?? []).map(r => r.tarea_id));
  // Archived tasks stay visible in their historical dates, including every completed occurrence.
  const delDia = (tareas.data ?? []).filter(t => tareaOcurreEnFecha(t as AgendaTarea, fecha) || idsRealizados.has(t.id));
  const pacientesDelDia = new Set(delDia.map(t => t.paciente_id));
  const filasPacientes = (pacientes.data ?? []).filter(p => p.activo || pacientesDelDia.has(p.id));
  return <AgendaCliente key={fecha}
    pacientes={filasPacientes} personal={personal.data ?? []} tareas={delDia}
    realizaciones={realizacionesActuales} medicamentos={medicamentos.data ?? []}
    fecha={fecha} hoy={hoy} ahora={ahora} esAdmin={usuario.esAdmin} miPersonalId={usuario.personal?.id ?? null}
    errorCarga={fallo ? "No se pudo cargar la agenda completa. Actualiza la página antes de registrar cambios." : undefined}
  />;
}
