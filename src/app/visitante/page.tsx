import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";

export default async function AccesoVisitante() {
  const usuario = await getUsuarioActual();
  redirect(usuario ? "/visitas" : "/login");
}
