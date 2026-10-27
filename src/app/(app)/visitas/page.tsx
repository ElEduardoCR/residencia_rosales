import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import VisitasCliente from "@/components/VisitasCliente";

export const dynamic = "force-dynamic";

export default async function VisitasPage({ searchParams }: { searchParams: Promise<{ paciente?: string }> }) {
  const { paciente } = await searchParams;
  if (paciente) redirect(`/salidas?paciente=${encodeURIComponent(paciente)}`);
  const supabase = await createClient();
  const [visitas, pacientes] = await Promise.all([
    supabase.from("visitas").select("*, pacientes(nombre)").order("fecha", { ascending: false }).limit(100),
    supabase.from("pacientes").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  return <div><PageHeader title="Visitas" subtitle="Recibe a familiares y acompaña sus visitas a la residencia." />
    {visitas.error || pacientes.error ? <p role="alert" className="card p-5 text-sm text-red-700">No se pudo cargar el registro de visitas. Actualiza la página para volver a intentarlo.</p> : <VisitasCliente visitas={visitas.data ?? []} pacientes={pacientes.data ?? []} />}
  </div>;
}
