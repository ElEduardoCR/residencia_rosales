import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui";
import ActividadesTabs from "@/components/ActividadesTabs";
import { fechaEnZona } from "@/lib/utils";
import { ZONA_HORARIA } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function ActividadesPage() {
  const supabase = await createClient();
  const usuario = await getUsuarioActual();
  const fecha = fechaEnZona(ZONA_HORARIA);

  const [pacientes, personal, programadas, completadas] = await Promise.all([
    supabase.from("pacientes").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("personal").select("id, nombre").eq("activo", true).order("nombre"),
    supabase.from("actividades_programadas").select("*").eq("activo", true).order("hora"),
    supabase.from("actividades_completadas").select("*").eq("fecha", fecha),
  ]);

  return (
    <div>
      <PageHeader
        title="Actividades y eventos"
        subtitle="Actividades programadas del día y registro diario por paciente"
      />
      {(pacientes.data ?? []).length === 0 && (programadas.data ?? []).length === 0 ? (
        <EmptyState icon="📋" title="Sin actividades" hint="El administrador puede crear actividades programadas y dar de alta pacientes." />
      ) : (
        <ActividadesTabs
          pacientes={pacientes.data ?? []}
          personal={personal.data ?? []}
          programadas={programadas.data ?? []}
          completadasHoy={completadas.data ?? []}
          esAdmin={usuario?.esAdmin ?? false}
          miPersonalId={usuario?.personal?.id ?? null}
          fecha={fecha}
        />
      )}
    </div>
  );
}
