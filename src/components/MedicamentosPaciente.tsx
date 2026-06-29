"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TURNOS } from "@/lib/constants";
import type { MedicamentoPaciente, Turno } from "@/lib/types";
import MedicamentoAutocomplete from "./MedicamentoAutocomplete";

export default function MedicamentosPaciente({
  pacienteId,
  inicial,
}: {
  pacienteId: string;
  inicial: MedicamentoPaciente[];
}) {
  const supabase = createClient();
  const [lista, setLista] = useState<MedicamentoPaciente[]>(inicial);
  const [nombre, setNombre] = useState("");
  const [dosis, setDosis] = useState("");
  const [frecuencia, setFrecuencia] = useState("");
  const [turnos, setTurnos] = useState<Turno[]>([]);

  function toggleTurno(t: Turno) {
    setTurnos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;
    const { data } = await supabase
      .from("medicamentos_paciente")
      .insert({
        paciente_id: pacienteId,
        medicamento_nombre: nombre.trim(),
        dosis: dosis || null,
        frecuencia: frecuencia || null,
        turnos,
      })
      .select()
      .single();
    if (data) {
      setLista((prev) => [...prev, data]);
      setNombre("");
      setDosis("");
      setFrecuencia("");
      setTurnos([]);
    }
  }

  async function eliminar(id: string) {
    await supabase.from("medicamentos_paciente").delete().eq("id", id);
    setLista((prev) => prev.filter((m) => m.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="mb-3 font-semibold text-slate-800">Agregar medicamento obligatorio</h3>
        <form onSubmit={agregar} className="space-y-3">
          <div>
            <label className="label">Medicamento (busca en el catálogo o escríbelo)</label>
            <MedicamentoAutocomplete onSelect={(m) => setNombre(m.nombre)} />
            <input
              className="input mt-2"
              placeholder="Nombre del medicamento"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Dosis</label>
              <input className="input" placeholder="Ej. 1 tableta" value={dosis} onChange={(e) => setDosis(e.target.value)} />
            </div>
            <div>
              <label className="label">Frecuencia</label>
              <input className="input" placeholder="Ej. cada 8 horas" value={frecuencia} onChange={(e) => setFrecuencia(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label">Turnos en que se administra</label>
            <div className="flex gap-2">
              {TURNOS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => toggleTurno(t.value)}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                    turnos.includes(t.value)
                      ? "border-marca-300 bg-marca-50 text-marca-700"
                      : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Agregar</button>
        </form>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-slate-400">Sin medicamentos obligatorios.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((m) => (
            <div key={m.id} className="card flex items-center justify-between gap-2 p-4">
              <div>
                <div className="font-medium text-slate-800">{m.medicamento_nombre}</div>
                <div className="text-xs text-slate-500">
                  {[m.dosis, m.frecuencia].filter(Boolean).join(" · ")}
                  {m.turnos.length > 0 && ` · ${m.turnos.join(", ")}`}
                </div>
              </div>
              <button onClick={() => eliminar(m.id)} className="btn btn-danger btn-sm">Eliminar</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
