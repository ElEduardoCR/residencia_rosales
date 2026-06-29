import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import PacienteForm from "@/components/PacienteForm";

export default async function EditarPaciente({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: paciente } = await supabase.from("pacientes").select("*").eq("id", id).single();

  if (!paciente) notFound();

  return (
    <div>
      <PageHeader title="Editar paciente" subtitle={paciente.nombre} />
      <PacienteForm paciente={paciente} />
    </div>
  );
}
