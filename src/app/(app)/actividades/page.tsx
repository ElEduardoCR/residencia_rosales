import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui";
import ActividadesCliente from "@/components/ActividadesCliente";

export const dynamic = "force-dynamic";

export default async function ActividadesPage() {
  const supabase = await createClient();
  const [pacientes, personal] = await Promise.all([
    supabase.from("pacientes").select("id,nombre").eq("activo", true).order("nombre"),
    supabase.from("personal").select("id,nombre").order("nombre"),
  ]);
  return <div>
    <PageHeader title="Registro diario" subtitle="Alimentación, turnos y medicamentos de cada paciente" />
    <Link href="/agenda" className="btn btn-secondary mb-5">Abrir agenda por hora y paciente →</Link>
    {pacientes.error || personal.error ? <p role="alert" className="card p-5 text-sm text-red-700">No se pudo cargar el registro. Actualiza la página para volver a intentarlo.</p>
      : pacientes.data?.length ? <ActividadesCliente pacientes={pacientes.data} personal={personal.data ?? []} />
      : <EmptyState icon="📋" title="Sin pacientes" hint="Agrega pacientes para empezar a registrar sus cuidados." />}
  </div>;
}
