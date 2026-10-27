import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import PacienteDetalle from "@/components/PacienteDetalle";

export const dynamic = "force-dynamic";

export default async function PacientePage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const tabInicial = tab === "medicamentos" ? "medicamentos" : "info";
  const supabase = await createClient();
  const usuario = await getUsuarioActual();

  const [paciente, personal, obligatorios, salidas] = await Promise.all([
    supabase.from("pacientes").select("*").eq("id", id).maybeSingle(),
    supabase.from("personal").select("id, nombre").eq("activo", true).order("nombre"),
    supabase
      .from("medicamentos_paciente")
      .select("*")
      .eq("paciente_id", id)
      .eq("activo", true)
      .order("created_at"),
    supabase
      .from("salidas")
      .select("*")
      .eq("paciente_id", id)
      .order("fecha_salida", { ascending: false }),
  ]);

  if (paciente.error || personal.error || obligatorios.error || salidas.error) {
    return <div role="alert" className="card p-6 text-sm text-red-700"><p>No se pudo cargar el expediente completo. Actualiza la página antes de consultar o registrar medicamentos.</p><Link className="mt-3 inline-block underline" href="/pacientes">Volver a pacientes</Link></div>;
  }
  if (!paciente.data) notFound();

  return (
    <PacienteDetalle
      key={`${id}:${tabInicial}`}
      tabInicial={tabInicial}
      paciente={paciente.data}
      personal={personal.data ?? []}
      obligatorios={obligatorios.data ?? []}
      salidas={salidas.data ?? []}
      esAdmin={usuario?.esAdmin ?? false}
    />
  );
}
