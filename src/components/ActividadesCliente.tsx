"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MedicamentoPaciente } from "@/lib/types";
import RegistroDiario from "./RegistroDiario";

type PersonalMin = { id: string; nombre: string };
type PacienteMin = { id: string; nombre: string };

export default function ActividadesCliente({
  pacientes,
  personal,
}: {
  pacientes: PacienteMin[];
  personal: PersonalMin[];
}) {
  const supabase = createClient();
  const [pacienteId, setPacienteId] = useState<string>("");
  const [obligatorios, setObligatorios] = useState<MedicamentoPaciente[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!pacienteId) {
      setObligatorios([]);
      return;
    }
    setCargando(true);
    supabase
      .from("medicamentos_paciente")
      .select("*")
      .eq("paciente_id", pacienteId)
      .eq("activo", true)
      .order("created_at")
      .then(({ data }) => {
        setObligatorios(data ?? []);
        setCargando(false);
      });
  }, [pacienteId, supabase]);

  return (
    <div className="space-y-5">
      <div className="card p-4">
        <label className="label">Paciente</label>
        <select className="input max-w-sm" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)}>
          <option value="">— Selecciona un paciente —</option>
          {pacientes.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}</option>
          ))}
        </select>
      </div>

      {pacienteId && !cargando && (
        <RegistroDiario pacienteId={pacienteId} personal={personal} obligatorios={obligatorios} />
      )}
    </div>
  );
}
