import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import SalidasCliente from "@/components/SalidasCliente";

export const dynamic = "force-dynamic";

export default async function SalidasPage({ searchParams }: { searchParams: Promise<{ paciente?: string }> }) {
  const { paciente } = await searchParams;
  const supabase = await createClient();
  const [salidas, pacientes, personal] = await Promise.all([
    supabase.from("salidas").select("*, pacientes(nombre)").order("fecha_salida", { ascending: false }).order("created_at", { ascending: false }),
    supabase.from("pacientes").select("id, nombre, tutor_nombre, tutor_parentesco").eq("activo", true).order("nombre"),
    supabase.from("personal").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  return <div>
    <PageHeader title="Registro de salida" subtitle="Acompañamos cada salida, cuidamos cada regreso." />
    <SalidasCliente salidas={salidas.data ?? []} pacientes={pacientes.data ?? []} personal={personal.data ?? []} pacienteInicial={paciente ?? ""} errorCarga={salidas.error || pacientes.error || personal.error ? "No se pudo cargar el registro completo. Actualiza la página para volver a intentarlo." : undefined} />
  </div>;
}
