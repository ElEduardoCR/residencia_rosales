import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import PersonalCliente from "@/components/PersonalCliente";

export const dynamic = "force-dynamic";

export default async function PersonalPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.esAdmin) redirect("/");

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
