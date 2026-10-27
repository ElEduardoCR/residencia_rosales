"use server";

import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";

// La consulta pública anterior no verificaba el vínculo con el paciente.
export async function registrarAcceso() {
  const usuario = await getUsuarioActual();
  redirect(usuario ? "/visitas" : "/login");
}

export async function salirVisitante() { redirect("/login"); }
