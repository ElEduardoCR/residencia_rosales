import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import PacienteForm from "@/components/PacienteForm";

export default async function NuevoPaciente() {
  const usuario = await getUsuarioActual();
  if (!usuario?.esAdmin) redirect("/pacientes");

  return (
    <div>
      <PageHeader title="Alta de paciente" subtitle="Registra un nuevo paciente" />
      <PacienteForm />
    </div>
  );
}
