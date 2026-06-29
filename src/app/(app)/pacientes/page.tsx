import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";
import ListaPacientes from "@/components/ListaPacientes";

export const dynamic = "force-dynamic";

export default async function PacientesPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const esAdmin = usuario?.esAdmin ?? false;
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
          esAdmin ? (
            <Link href="/pacientes/nuevo" className="btn btn-primary">
              ➕ Nuevo paciente
            </Link>
          ) : undefined
        }
      />
      {pacientes.length === 0 ? (
        <EmptyState
          icon="👴"
          title="Aún no hay pacientes"
          hint={esAdmin ? "Da de alta al primer paciente para comenzar." : "El administrador aún no registra pacientes."}
          action={
            esAdmin ? (
              <Link href="/pacientes/nuevo" className="btn btn-primary mt-2">
                Dar de alta
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ListaPacientes pacientes={pacientes} />
      )}
    </div>
  );
}
