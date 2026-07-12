import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import PacienteDetalle from "@/components/PacienteDetalle";

export const dynamic = "force-dynamic";

export default async function PacientePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const usuario = await getUsuarioActual();

  const [paciente, personal, obligatorios, salidas] = await Promise.all([
    supabase.from("pacientes").select("*").eq("id", id).single(),
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

  if (!paciente.data) notFound();

  return (
    <PacienteDetalle
      paciente={paciente.data}
      personal={personal.data ?? []}
      obligatorios={obligatorios.data ?? []}
      salidas={salidas.data ?? []}
      esAdmin={usuario?.esAdmin ?? false}
    />
  );
}
