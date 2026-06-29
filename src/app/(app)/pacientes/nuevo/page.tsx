import { PageHeader } from "@/components/ui";
import PacienteForm from "@/components/PacienteForm";

export default function NuevoPaciente() {
  return (
    <div>
      <PageHeader title="Alta de paciente" subtitle="Registra un nuevo paciente" />
      <PacienteForm />
    </div>
  );
}
