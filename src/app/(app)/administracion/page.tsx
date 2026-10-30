import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { cargarAdministracionTurnos } from "@/lib/turnos-server";
import AdministracionCliente from "@/components/AdministracionCliente";

export const dynamic = "force-dynamic";
export default async function AdministracionPage() {
  const usuario = await getUsuarioActual();
  if (!usuario?.esAdmin || usuario.userId === "local") redirect("/turno");
  const datos = await cargarAdministracionTurnos();
  return <AdministracionCliente datos={datos} />;
}
