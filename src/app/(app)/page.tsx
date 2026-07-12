import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { Stat } from "@/components/ui";
import NotificacionesToggle from "@/components/NotificacionesToggle";
import { ahoraEnZona, fechaEnZona, horaCorta } from "@/lib/utils";
import { ZONA_HORARIA, TOLERANCIA_MIN } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const esAdmin = usuario?.esAdmin ?? false;
  const fecha = fechaEnZona(ZONA_HORARIA);
  const { diaSemana, minutos } = ahoraEnZona(ZONA_HORARIA);

  const [pacientes, inventario, salidas, personal, programadas, completadas] = await Promise.all([
    supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("medicamentos_paciente").select("medicamento_nombre, cantidad, minimo, presentacion, paciente_id, pacientes(nombre)").eq("activo", true),
    supabase.from("salidas").select("id", { count: "exact", head: true }).eq("estado", "fuera"),
    supabase.from("personal").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("actividades_programadas").select("*").eq("activo", true).order("hora"),
    supabase.from("actividades_completadas").select("actividad_id").eq("fecha", fecha),
  ]);

  const items = (inventario.data ?? []) as unknown as {
    medicamento_nombre: string;
    cantidad: number;
    minimo: number;
    presentacion: string | null;
    paciente_id: string;
    pacientes: { nombre: string } | null;
  }[];
  const bajos = items.filter((m) => Number(m.minimo) > 0 && Number(m.cantidad) <= Number(m.minimo));

  const hechas = new Set((completadas.data ?? []).map((c) => c.actividad_id));
  const proximas = (programadas.data ?? [])
    .filter((a) => a.dias_semana?.includes(diaSemana) && !hechas.has(a.id))
    .map((a) => {
      const [h, m] = String(a.hora).split(":").map(Number);
      return { ...a, atrasada: minutos > h * 60 + m + TOLERANCIA_MIN };
    });

  const accesos = [
    { href: "/pacientes/nuevo", label: "Alta de paciente", icon: "➕", adminOnly: true },
    { href: "/actividades", label: "Actividades", icon: "📋" },
    { href: "/visitas", label: "Visitas y salidas", icon: "🚪" },
    { href: "/menu", label: "Menú semanal", icon: "🍽️" },
    { href: "/personal", label: "Personal", icon: "🩺", adminOnly: true },
  ].filter((a) => esAdmin || !a.adminOnly);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Panel general</h1>
        <p className="mt-1 text-sm text-slate-500">Hola {usuario?.nombre}, este es el resumen de hoy</p>
      </div>

      <div className="mb-6">
        <NotificacionesToggle />
      </div>

      {/* Próximas actividades */}
      <div className="card mb-6 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">🔔 Próximas actividades</h2>
          <Link href="/actividades" className="text-sm font-medium text-marca-700 hover:underline">Ver todas →</Link>
        </div>
        {proximas.length === 0 ? (
          <p className="text-sm text-slate-400">No hay actividades pendientes para hoy. 🎉</p>
        ) : (
          <div className="space-y-2">
            {proximas.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2">
                <span className="font-mono text-sm font-semibold text-marca-700">{horaCorta(a.hora)}</span>
                <span className="flex-1 text-sm text-slate-700">{a.titulo}</span>
                {a.atrasada && <span className="badge bg-amber-100 text-amber-800">Atrasada</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Pacientes activos" value={pacientes.count ?? 0} href="/pacientes" tono="marca" />
        <Stat
          label="Medicamentos bajo mínimo"
          value={bajos.length}
          tono={bajos.length > 0 ? "amber" : "emerald"}
          hint={bajos.length > 0 ? "Requieren resurtido" : "Todo en orden"}
        />
        <Stat label="Pacientes fuera" value={salidas.count ?? 0} href="/visitas" tono="sky" />
        <Stat label="Personal activo" value={personal.count ?? 0} href={esAdmin ? "/personal" : undefined} />
      </div>

      {bajos.length > 0 && (
        <div className="card mt-6 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <h2 className="font-semibold text-slate-800">Resurtir medicamentos</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {bajos.map((m, idx) => (
              <Link key={idx} href={`/pacientes/${m.paciente_id}`} className="badge bg-amber-100 text-amber-800 hover:bg-amber-200">
                {m.medicamento_nombre}{m.pacientes?.nombre ? ` (${m.pacientes.nombre})` : ""} · {Number(m.cantidad)} {m.presentacion ?? ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <h2 className="mb-3 font-semibold text-slate-800">Accesos rápidos</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {accesos.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="card flex items-center gap-3 p-4 transition hover:border-marca-300 hover:shadow-md"
            >
              <span className="text-2xl">{a.icon}</span>
              <span className="text-sm font-medium text-slate-700">{a.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
