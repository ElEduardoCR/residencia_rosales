import { redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/server";
import MedicamentosGeneral from "@/components/MedicamentosGeneral";

export const dynamic = "force-dynamic";
export default async function MedicamentosPage() {
  const usuario = await getUsuarioActual();
  if (!usuario || usuario.userId === "local") redirect("/login");
  const db = await createAuthClient();
  const [medicamentos,pacientes] = await Promise.all([
    db.from("medicamentos_paciente").select("id,paciente_id,medicamento_nombre,dosis,frecuencia,presentacion,cantidad,minimo,activo,notas,turnos,stock_verificado_at", {count:"exact"}).eq("activo",true).order("medicamento_nombre").limit(1000),
    db.from("pacientes").select("id,nombre,activo", {count:"exact"}).order("nombre").limit(1000),
  ]);
  const error = [medicamentos,pacientes].some(r=>r.error || r.count===null || r.count>1000);
  return <MedicamentosGeneral medicamentos={medicamentos.data??[]} pacientes={pacientes.data??[]} esAdmin={usuario.esAdmin} errorCarga={error?"No se pudo cargar la lista completa de medicamentos. Actualiza la página antes de registrar un conteo.":undefined} />;
}
