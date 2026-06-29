"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ITEMS_SALIDA_DEFAULT, PARENTESCOS } from "@/lib/constants";
import { hoyISO, diasEntre } from "@/lib/utils";
import { subirDataURL } from "@/lib/storage";
import type { ItemInventarioSalida } from "@/lib/types";
import SignaturePad from "./SignaturePad";

type PacienteMin = { id: string; nombre: string };
type PersonalMin = { id: string; nombre: string };

export default function SalidaForm({
  pacientes,
  personal,
  pacienteInicial = "",
  onCreada,
}: {
  pacientes: PacienteMin[];
  personal: PersonalMin[];
  pacienteInicial?: string;
  onCreada?: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [pacienteId, setPacienteId] = useState(pacienteInicial);
  const [quienLoLleva, setQuienLoLleva] = useState("");
  const [parentesco, setParentesco] = useState("");
  const [fechaSalida, setFechaSalida] = useState(hoyISO());
  const [horaSalida, setHoraSalida] = useState("");
  const [fechaRegresoEst, setFechaRegresoEst] = useState("");
  const [condicion, setCondicion] = useState("");
  const [firma, setFirma] = useState<string | null>(null);
  const [enfermeroEntregaId, setEnfermeroEntregaId] = useState("");
  const [firmaEnfermero, setFirmaEnfermero] = useState<string | null>(null);

  const [inventario, setInventario] = useState<ItemInventarioSalida[]>(
    ITEMS_SALIDA_DEFAULT.map((nombre) => ({ nombre, llevado: false })),
  );
  const [nuevoItem, setNuevoItem] = useState("");

  function toggleItem(i: number) {
    setInventario((prev) => prev.map((it, idx) => (idx === i ? { ...it, llevado: !it.llevado } : it)));
  }
  function agregarItem() {
    const n = nuevoItem.trim();
    if (!n) return;
    setInventario((prev) => [...prev, { nombre: n, llevado: true }]);
    setNuevoItem("");
  }

  const diasEstimados = fechaRegresoEst ? diasEntre(fechaSalida, fechaRegresoEst) : null;
  const excede20 = diasEstimados !== null && diasEstimados > 20;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!pacienteId) return setError("Selecciona un paciente.");
    if (excede20) return setError("La salida no puede superar 20 días.");
    setGuardando(true);
    setError(null);

    let firmaUrl: string | null = null;
    if (firma) firmaUrl = await subirDataURL(supabase, "firmas", firma);
    let firmaEnfUrl: string | null = null;
    if (firmaEnfermero) firmaEnfUrl = await subirDataURL(supabase, "firmas", firmaEnfermero);

    const { error } = await supabase.from("salidas").insert({
      paciente_id: pacienteId,
      quien_lo_lleva: quienLoLleva.trim(),
      parentesco: parentesco || null,
      fecha_salida: fechaSalida,
      hora_salida: horaSalida || null,
      fecha_regreso_estimada: fechaRegresoEst || null,
      inventario,
      condicion_fisica_salida: condicion || null,
      firma_salida_url: firmaUrl,
      enfermero_entrega_id: enfermeroEntregaId || null,
      firma_salida_enfermero_url: firmaEnfUrl,
      estado: "fuera",
    });

    if (error) {
      setError(error.message);
      setGuardando(false);
      return;
    }
    if (onCreada) onCreada();
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Paciente *</label>
          <select className="input" value={pacienteId} onChange={(e) => setPacienteId(e.target.value)} required>
            <option value="">— Selecciona —</option>
            {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="label">¿Quién se lo lleva? *</label>
          <input className="input" required value={quienLoLleva} onChange={(e) => setQuienLoLleva(e.target.value)} />
        </div>
        <div>
          <label className="label">Parentesco</label>
          <select className="input" value={parentesco} onChange={(e) => setParentesco(e.target.value)}>
            <option value="">—</option>
            {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Fecha de salida *</label>
          <input type="date" className="input" required value={fechaSalida} onChange={(e) => setFechaSalida(e.target.value)} />
        </div>
        <div>
          <label className="label">Hora de salida</label>
          <input type="time" className="input" value={horaSalida} onChange={(e) => setHoraSalida(e.target.value)} />
        </div>
        <div>
          <label className="label">Fecha estimada de regreso</label>
          <input type="date" className="input" value={fechaRegresoEst} onChange={(e) => setFechaRegresoEst(e.target.value)} />
          {diasEstimados !== null && (
            <p className={`mt-1 text-xs ${excede20 ? "text-red-600" : "text-slate-500"}`}>
              {diasEstimados} día(s){excede20 && " — supera el máximo de 20 días"}
            </p>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h3 className="mb-3 font-semibold text-slate-800">Inventario que lleva el paciente</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {inventario.map((it, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input type="checkbox" checked={it.llevado} onChange={() => toggleItem(i)} className="h-4 w-4 accent-marca-700" />
              <span className={it.llevado ? "text-slate-800" : "text-slate-400"}>{it.nombre}</span>
            </label>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            className="input max-w-xs"
            placeholder="Agregar otro artículo…"
            value={nuevoItem}
            onChange={(e) => setNuevoItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarItem(); } }}
          />
          <button type="button" onClick={agregarItem} className="btn btn-secondary">Agregar</button>
        </div>
      </div>

      <div className="card space-y-2 p-5">
        <label className="label">Condición física al salir</label>
        <textarea className="input min-h-20" value={condicion} onChange={(e) => setCondicion(e.target.value)} />
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <label className="label">Enfermero que entrega al paciente</label>
          <select className="input max-w-sm" value={enfermeroEntregaId} onChange={(e) => setEnfermeroEntregaId(e.target.value)}>
            <option value="">— Selecciona —</option>
            {personal.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <SignaturePad value={firmaEnfermero} onChange={setFirmaEnfermero} label="Firma del enfermero que entrega" />
          <SignaturePad value={firma} onChange={setFirma} label="Firma de quien se lleva al paciente" />
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={guardando || excede20} className="btn btn-primary">
          {guardando ? "Guardando…" : "Registrar salida"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-secondary">Cancelar</button>
      </div>
    </form>
  );
}
