import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import ActividadesCliente from "@/components/ActividadesCliente";

export const dynamic = "force-dynamic";

export default async function ActividadesPage() {
  const supabase = await createClient();
  const [pacientes, personal] = await Promise.all([
    supabase.from("pacientes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("personal").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return (
    <div>
      <PageHeader
        title="Actividades y eventos"
        subtitle="Registro diario por turnos: evacuaciones, orina, alimentación y medicamentos"
      />
      {(pacientes.data ?? []).length === 0 ? (
        <EmptyState icon="👴" title="No hay pacientes" hint="Primero da de alta a un paciente." />
      ) : (
        <ActividadesCliente pacientes={pacientes.data ?? []} personal={personal.data ?? []} />
      )}
    </div>
  );
}
