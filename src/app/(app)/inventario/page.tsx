import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import InventarioResumen from "@/components/InventarioResumen";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventario_paciente")
    .select("*, pacientes(nombre)")
    .eq("activo", true)
    .order("nombre");

  return (
    <div>
      <PageHeader
        title="Inventario de medicamentos"
        subtitle="Resumen de existencias de todos los pacientes. El inventario se gestiona en la ficha de cada paciente."
      />
      <InventarioResumen items={data ?? []} />
    </div>
  );
}
