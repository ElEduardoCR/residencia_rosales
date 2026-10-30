import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { existenciasSinVerificar } from "@/lib/medication-verification";
import { Stat } from "@/components/ui";
import Icon, { type IconName } from "@/components/Icon";
import NotificacionesToggle from "@/components/NotificacionesToggle";
import { ahoraEnZona, fechaEnZona, horaCorta } from "@/lib/utils";
import { ZONA_HORARIA } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  if (!usuario?.esAdmin || usuario.userId === "local") redirect("/turno");
  const esAdmin = true;
  const fecha = fechaEnZona(ZONA_HORARIA);
  const { diaSemana, minutos } = ahoraEnZona(ZONA_HORARIA);

  const [pacientes, inventario, salidas, personal, programadas, completadas, completadasTurno] = await Promise.all([
    supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("medicamentos_paciente").select("medicamento_nombre, cantidad, minimo, presentacion, notas, stock_verificado_at, paciente_id, pacientes(nombre)").eq("activo", true),
    supabase.from("salidas").select("id", { count: "exact", head: true }).eq("estado", "fuera"),
    supabase.from("personal").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("agenda_tareas").select("id,titulo,hora,dias_semana,pacientes(nombre)").eq("activo", true).lte("fecha_inicio", fecha).or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`).order("hora"),
    supabase.from("agenda_realizaciones").select("tarea_id").eq("fecha", fecha).is("turno_evento_id", null),
    supabase.from("turnos_eventos_vigentes").select("agenda_tarea_id").eq("agenda_fecha", fecha),
  ]);

  const items = (inventario.data ?? []) as unknown as {
    medicamento_nombre: string;
    cantidad: number;
    minimo: number;
    presentacion: string | null;
    notas: string | null;
    stock_verificado_at: string | null;
    paciente_id: string;
    pacientes: { nombre: string } | null;
  }[];
  const sinConteo = items.filter(m => !m.stock_verificado_at || existenciasSinVerificar(m.notas));
  const bajos = items.filter((m) => m.stock_verificado_at && !existenciasSinVerificar(m.notas) && Number(m.minimo) > 0 && Number(m.cantidad) <= Number(m.minimo));

  const hechas = new Set([...(completadas.data ?? []).map((c) => c.tarea_id), ...(completadasTurno.data ?? []).map(c => c.agenda_tarea_id)]);
  const proximas = (programadas.data ?? [])
    .filter((a) => a.dias_semana?.includes(diaSemana) && !hechas.has(a.id))
    .map((a) => {
      const [h, m] = String(a.hora).split(":").map(Number);
      const paciente = a.pacientes as unknown as { nombre: string } | null;
      return { ...a, pacienteNombre: paciente?.nombre, atrasada: minutos > h * 60 + m };
    });

  const accesos: { href: string; label: string; description: string; icon: IconName; adminOnly?: boolean }[] = [
    { href: "/turno", label: "Mi turno", description: "Cuidados y registros del turno vigente", icon: "clock" },
    { href: "/historial", label: "Historial y promedios", description: "Consulta registros y sus correcciones", icon: "clipboard" },
    { href: "/medicamentos", label: "Medicamentos", description: "Tratamientos, conteos y existencias", icon: "pill" },
    { href: "/agenda", label: "Agenda por hora", description: "Tareas, responsables y seguimiento", icon: "clock" },
    { href: "/pacientes", label: "Pacientes", description: "Expedientes y tratamientos", icon: "patients" },
    { href: "/salidas", label: "Registro de salida", description: "Acompañantes, pertenencias y firmas", icon: "exit" },
    { href: "/menu", label: "Menú semanal", description: "La alimentación de cada día", icon: "menu" },
    { href: "/personal", label: "Nuestro equipo", description: "Personal y turnos", icon: "staff", adminOnly: true },
  ];
  const errorDatos = [pacientes, inventario, salidas, personal, programadas, completadas, completadasTurno].some((r) => r.error);
  const fechaLarga = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: ZONA_HORARIA }).format(new Date());

  return <div className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div><p className="eyebrow mb-2 capitalize">{fechaLarga}</p><h1 className="page-title">Un día para cuidar.</h1></div>
      {esAdmin && <Link href="/pacientes/nuevo" className="btn btn-primary"><Icon name="plus" width="18" height="18" />Nuevo paciente</Link>}
    </div>

    <section className="dashboard-greeting flex items-center justify-between gap-5 rounded-[24px] px-6 py-6 md:px-7">
      <div><h2 className="text-lg font-semibold tracking-tight text-slate-900">Hola, {usuario?.nombre}.</h2><p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">Aquí tienes el resumen de la residencia. Todo lo que necesitas para acompañar a nuestros pacientes.</p></div>
      <div aria-hidden="true" className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-full border border-marca-200 text-marca-700 sm:flex"><Icon name="heart" width="26" height="26" /></div>
    </section>

    {errorDatos && <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">Algunos datos no pudieron cargarse. Actualiza la página para volver a intentarlo.</p>}

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      <Stat label="Pacientes activos" value={pacientes.error ? "—" : pacientes.count ?? 0} href="/pacientes" tono="marca" icon="patients" hint="Con nosotros, cada día" />
      <Stat label={sinConteo.length ? "Existencias por verificar" : "Por resurtir"} value={inventario.error ? "—" : sinConteo.length || bajos.length} tono={sinConteo.length || bajos.length ? "amber" : "slate"} icon="pill" href="/medicamentos" hint={inventario.error ? "Sin información disponible" : sinConteo.length ? "Conteo de medicamentos pendiente" : bajos.length > 0 ? "Medicamentos bajo mínimo" : "Sin alertas de inventario"} />
      <Stat label="Pacientes fuera" value={salidas.error ? "—" : salidas.count ?? 0} href="/salidas" icon="exit" hint="Con salida registrada" />
      <Stat label="Personal activo" value={personal.error ? "—" : personal.count ?? 0} href={esAdmin ? "/personal" : undefined} icon="staff" hint="Nuestro equipo de cuidado" />
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-5"><div className="flex items-center gap-2.5"><Icon name="clock" className="text-marca-700" /><h2 className="section-title">La agenda de hoy</h2></div><Link href="/agenda" className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-marca-700 hover:underline">Ver línea de tiempo<Icon name="arrow" width="15" height="15" /></Link></div>
        {programadas.error || completadas.error || completadasTurno.error ? <p className="px-6 py-10 text-sm text-slate-500">No se pudo consultar la agenda.</p> : proximas.length === 0 ? <div className="flex flex-col items-center px-6 py-12 text-center"><div className="icon-tile mb-4"><Icon name="check" width="24" height="24" /></div><h3 className="font-semibold text-slate-700">{(programadas.data ?? []).length ? "Tareas de hoy realizadas" : "Organiza el día de cada paciente"}</h3><p className="mt-1.5 max-w-xs text-sm text-slate-500">{(programadas.data ?? []).length ? "No hay tareas pendientes para hoy." : "Programa los cuidados con su hora para verlos en la línea de tiempo."}</p><Link href="/agenda" className="btn btn-secondary mt-5">Abrir agenda por hora</Link></div> : <div className="divide-y divide-slate-100 px-6">{proximas.slice(0, 6).map((a) => <div key={a.id} className="flex flex-wrap items-center gap-3 py-4"><span className="w-14 text-sm font-semibold tabular-nums text-marca-700">{horaCorta(a.hora)}</span><span className="min-w-0 flex-1 text-sm font-medium text-slate-700">{a.titulo}{a.pacienteNombre && <span className="mt-0.5 block text-xs font-normal text-slate-500">{a.pacienteNombre}</span>}</span>{a.atrasada && <span className="badge bg-amber-100 text-amber-800">Atrasada</span>}</div>)}{proximas.length > 6 && <Link href="/agenda" className="block py-4 text-sm font-medium text-marca-700">Ver las {proximas.length} actividades pendientes →</Link>}</div>}
      </section>
      <section><h2 className="section-title mb-4 px-1">A un paso</h2><div className="space-y-3">{accesos.filter((a) => esAdmin || !a.adminOnly).map((a) => <Link key={a.href} href={a.href} className="card flex items-center gap-3.5 p-4 transition hover:border-marca-300 hover:shadow-md"><span className="icon-tile"><Icon name={a.icon} /></span><div className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{a.label}</span><span className="mt-0.5 block text-xs text-slate-500">{a.description}</span></div><Icon name="arrow" width="17" height="17" className="shrink-0 text-slate-400" /></Link>)}</div></section>
    </div>

    {bajos.length > 0 && <section className="card p-6"><div className="mb-4 flex items-center gap-2.5"><Icon name="pill" className="text-amber-700" /><h2 className="section-title">Medicamentos por resurtir</h2></div><div className="flex flex-wrap gap-2">{bajos.map((m, idx) => <Link key={idx} href={`/pacientes/${m.paciente_id}`} className="badge min-h-10 bg-amber-100 text-amber-800 hover:underline">{m.medicamento_nombre}{m.pacientes?.nombre ? ` · ${m.pacientes.nombre}` : ""} · {Number(m.cantidad)} {m.presentacion ?? ""}</Link>)}</div></section>}
    <NotificacionesToggle />
  </div>;
}
