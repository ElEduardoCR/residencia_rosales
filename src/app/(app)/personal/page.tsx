import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import PersonalCliente from "@/components/PersonalCliente";

export const dynamic = "force-dynamic";

export default async function PersonalPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("personal").select("*").order("nombre");

  return (
    <div>
      <PageHeader
        title="Personal"
        subtitle="Enfermeros y cuidadores con sus turnos y datos de contacto"
      />
      <PersonalCliente inicial={data ?? []} />
    </div>
  );
}
