import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Stat } from "@/components/ui";

export default async function Inicio() {
  const supabase = await createClient();

  const [pacientes, inventario, salidas, personal] = await Promise.all([
    supabase.from("pacientes").select("id", { count: "exact", head: true }).eq("activo", true),
    supabase.from("inventario_medicamentos").select("nombre, cantidad, minimo, unidad"),
    supabase.from("salidas").select("id", { count: "exact", head: true }).eq("estado", "fuera"),
    supabase.from("personal").select("id", { count: "exact", head: true }).eq("activo", true),
  ]);

  const items = inventario.data ?? [];
  const bajos = items.filter((m) => Number(m.cantidad) <= Number(m.minimo));

  const accesos = [
    { href: "/pacientes/nuevo", label: "Alta de paciente", icon: "➕" },
    { href: "/actividades", label: "Registrar actividades", icon: "📋" },
    { href: "/inventario", label: "Inventario", icon: "💊" },
    { href: "/visitas", label: "Visitas y salidas", icon: "🚪" },
    { href: "/menu", label: "Menú semanal", icon: "🍽️" },
    { href: "/personal", label: "Personal", icon: "🩺" },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Panel general</h1>
        <p className="mt-1 text-sm text-slate-500">Resumen de la residencia</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Pacientes activos" value={pacientes.count ?? 0} href="/pacientes" tono="marca" />
        <Stat
          label="Medicamentos bajo mínimo"
          value={bajos.length}
          href="/inventario"
          tono={bajos.length > 0 ? "amber" : "emerald"}
          hint={bajos.length > 0 ? "Requieren resurtido" : "Todo en orden"}
        />
        <Stat label="Pacientes fuera" value={salidas.count ?? 0} href="/visitas" tono="sky" />
        <Stat label="Personal activo" value={personal.count ?? 0} href="/personal" />
      </div>

      {bajos.length > 0 && (
        <div className="card mt-6 p-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-amber-500">⚠️</span>
            <h2 className="font-semibold text-slate-800">Resurtir medicamentos</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {bajos.map((m) => (
              <span key={m.nombre} className="badge bg-amber-100 text-amber-800">
                {m.nombre} · {Number(m.cantidad)} {m.unidad}
              </span>
            ))}
          </div>
          <Link href="/inventario" className="mt-3 inline-block text-sm font-medium text-marca-700 hover:underline">
            Ir al inventario →
          </Link>
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
