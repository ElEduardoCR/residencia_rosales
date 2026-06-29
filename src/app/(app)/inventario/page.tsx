import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import InventarioCliente from "@/components/InventarioCliente";

export const dynamic = "force-dynamic";

export default async function InventarioPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventario_medicamentos")
    .select("*")
    .order("nombre");

  return (
    <div>
      <PageHeader
        title="Inventario de medicamentos"
        subtitle="Existencias por pastilla y ml, con punto de resurtido"
      />
      <InventarioCliente inicial={data ?? []} />
    </div>
  );
}
