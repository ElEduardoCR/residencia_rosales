import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import MenuCliente from "@/components/MenuCliente";

export const dynamic = "force-dynamic";

export default async function MenuPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("menu_semanal").select("*");

  return (
    <div>
      <PageHeader title="Menú semanal" subtitle="Planeación de comidas de la semana" />
      <div className="card p-4">
        <MenuCliente inicial={data ?? []} />
      </div>
    </div>
  );
}
