import { cargarTurnoData } from "@/lib/turnos-server";
import TurnoCliente from "@/components/TurnoCliente";

export const dynamic = "force-dynamic";

export default async function TurnoPage() {
  const data = await cargarTurnoData();
  return <TurnoCliente key={data.contexto.ventana?.inicio ?? "sin-turno"} data={data} />;
}
