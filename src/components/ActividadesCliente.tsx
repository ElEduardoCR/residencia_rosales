"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MedicamentoPaciente } from "@/lib/types";
import RegistroDiario from "./RegistroDiario";

type PersonalMin = { id: string; nombre: string };
type PacienteMin = { id: string; nombre: string };

export default function ActividadesCliente({ pacientes, personal }: { pacientes: PacienteMin[]; personal: PersonalMin[] }) {
  const [pacienteId, setPacienteId] = useState("");
  return <div className="space-y-5">
    <div className="card p-4"><label htmlFor="actividad-paciente" className="label">Paciente</label><select id="actividad-paciente" className="input max-w-sm" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}><option value="">Selecciona un paciente</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
    {pacienteId && <RegistroPaciente key={pacienteId} pacienteId={pacienteId} personal={personal} />}
  </div>;
}

function RegistroPaciente({ pacienteId, personal }: { pacienteId: string; personal: PersonalMin[] }) {
  const [supabase] = useState(createClient);
  const [medicamentos, setMedicamentos] = useState<MedicamentoPaciente[] | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    const abort = new AbortController();
    supabase.from("medicamentos_paciente").select("*").eq("paciente_id", pacienteId).eq("activo", true).order("created_at").abortSignal(abort.signal)
      .then(({ data, error: fallo }) => {
        if (!vigente) return;
        if (fallo) setError("No se pudieron cargar los medicamentos. Actualiza la página para volver a intentarlo.");
        else setMedicamentos(data ?? []);
      }, () => { if (vigente) setError("No se pudieron cargar los medicamentos. Revisa tu conexión."); });
    return () => { vigente = false; abort.abort(); };
  }, [pacienteId, supabase]);
  if (error) return <p role="alert" className="card p-5 text-sm text-red-700">{error}</p>;
  if (medicamentos === null) return <p role="status" className="card p-5 text-sm text-slate-500">Cargando registro del paciente…</p>;
  return <RegistroDiario pacienteId={pacienteId} personal={personal} obligatorios={medicamentos} />;
}
