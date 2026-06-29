"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export async function registrarAcceso(formData: FormData) {
  const nombre = String(formData.get("nombre") || "").trim();
  const telefono = String(formData.get("telefono") || "").trim();
  const pacienteId = String(formData.get("paciente_id") || "");

  if (!nombre || !telefono || !pacienteId) {
    redirect("/visitante?error=1");
  }

  const admin = createAdminClient();
  await admin.from("accesos_visitantes").insert({
    visitante_nombre: nombre,
    telefono,
    paciente_id: pacienteId,
  });

  const cookieStore = await cookies();
  cookieStore.set("visitante", JSON.stringify({ pacienteId, nombre }), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 2, // 2 horas
  });

  redirect("/visitante/estado");
}

export async function salirVisitante() {
  const cookieStore = await cookies();
  cookieStore.delete("visitante");
  redirect("/visitante");
}
