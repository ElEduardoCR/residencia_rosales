import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import VisitasCliente from "@/components/VisitasCliente";

export const dynamic = "force-dynamic";

export default async function VisitasPage({
  searchParams,
}: {
  searchParams: Promise<{ paciente?: string }>;
}) {
  const { paciente } = await searchParams;
  const supabase = await createClient();

  const [salidas, visitas, pacientes] = await Promise.all([
    supabase.from("salidas").select("*, pacientes(nombre)").order("fecha_salida", { ascending: false }),
    supabase.from("visitas").select("*, pacientes(nombre)").order("fecha", { ascending: false }).limit(100),
    supabase.from("pacientes").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  return (
    <div>
      <PageHeader
        title="Visitas y salidas"
        subtitle="Registro de visitantes y salidas del paciente con su tutor (máx. 20 días)"
      />
      <VisitasCliente
        salidas={salidas.data ?? []}
        visitas={visitas.data ?? []}
        pacientes={pacientes.data ?? []}
        pacienteInicial={paciente ?? ""}
      />
    </div>
  );
}
