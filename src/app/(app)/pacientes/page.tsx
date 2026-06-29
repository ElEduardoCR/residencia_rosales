import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import ListaPacientes from "@/components/ListaPacientes";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("pacientes")
    .select("*")
    .eq("activo", true)
    .order("nombre");

  const pacientes = data ?? [];

  return (
    <div>
      <PageHeader
        title="Pacientes"
        subtitle={`${pacientes.length} paciente(s) activos`}
        action={
          <Link href="/pacientes/nuevo" className="btn btn-primary">
            ➕ Nuevo paciente
          </Link>
        }
      />
      {pacientes.length === 0 ? (
        <EmptyState
          icon="👴"
          title="Aún no hay pacientes"
          hint="Da de alta al primer paciente para comenzar."
          action={
            <Link href="/pacientes/nuevo" className="btn btn-primary mt-2">
              Dar de alta
            </Link>
          }
        />
      ) : (
        <ListaPacientes pacientes={pacientes} />
      )}
    </div>
  );
}
