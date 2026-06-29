import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import EstadoPaciente from "@/components/EstadoPaciente";
import { hoyISO } from "@/lib/utils";
import { salirVisitante } from "../actions";

export const dynamic = "force-dynamic";

export default async function EstadoVisitantePage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get("visitante")?.value;
  if (!raw) redirect("/visitante");

  let pacienteId = "";
  let visitante = "";
  try {
    const j = JSON.parse(raw!);
    pacienteId = j.pacienteId;
    visitante = j.nombre;
  } catch {
    redirect("/visitante");
  }
  if (!pacienteId) redirect("/visitante");

  const admin = createAdminClient();
  const fecha = hoyISO();
  const [paciente, alim, turnos, admins] = await Promise.all([
    admin.from("pacientes").select("*").eq("id", pacienteId).single(),
    admin.from("registros_alimentacion").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha).maybeSingle(),
    admin.from("registros_turno").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha),
    admin.from("administracion_medicamentos").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha).order("created_at"),
  ]);

  if (!paciente.data) redirect("/visitante");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between p-4">
          <div className="flex items-center gap-2 font-semibold text-slate-800">
            <span>🌹</span> Residencia Rosales
          </div>
          <form action={salirVisitante}>
            <button className="btn btn-secondary btn-sm">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-3xl p-4 md:p-8">
        <p className="mb-4 text-sm text-slate-500">Hola {visitante}, este es el estado actual:</p>
        <EstadoPaciente
          paciente={paciente.data}
          fecha={fecha}
          alimentacion={alim.data ?? null}
          turnos={turnos.data ?? []}
          administraciones={admins.data ?? []}
        />
      </main>
    </div>
  );
}
