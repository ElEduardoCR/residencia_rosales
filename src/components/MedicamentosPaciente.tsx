"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TURNOS, PRESENTACIONES } from "@/lib/constants";
import type { MedicamentoPaciente, Turno } from "@/lib/types";
import MedicamentoAutocomplete from "./MedicamentoAutocomplete";

type FormMed = {
  medicamento_nombre: string;
  presentacion: string;
  dosis: string;
  frecuencia: string;
  turnos: Turno[];
  cantidad: string;
  minimo: string;
  maximo: string;
  lugar_compra: string;
};

const VACIO: FormMed = {
  medicamento_nombre: "",
  presentacion: "",
  dosis: "",
  frecuencia: "",
  turnos: [],
  cantidad: "",
  minimo: "",
  maximo: "",
  lugar_compra: "",
};

const presDeTipo = (tipo: string) =>
  tipo === "ml" ? "ml" : tipo === "pastilla" ? "Pastilla" : "Otro";

function desdeMed(m: MedicamentoPaciente): FormMed {
  return {
    medicamento_nombre: m.medicamento_nombre,
    presentacion: m.presentacion ?? "",
    dosis: m.dosis ?? "",
    frecuencia: m.frecuencia ?? "",
    turnos: m.turnos ?? [],
    cantidad: m.cantidad?.toString() ?? "0",
    minimo: m.minimo?.toString() ?? "0",
    maximo: m.maximo?.toString() ?? "",
    lugar_compra: m.lugar_compra ?? "",
  };
}

function aPayload(f: FormMed) {
  return {
    medicamento_nombre: f.medicamento_nombre.trim(),
    presentacion: f.presentacion || null,
    dosis: f.dosis || null,
    frecuencia: f.frecuencia || null,
    turnos: f.turnos,
    cantidad: f.cantidad ? Number(f.cantidad) : 0,
    minimo: f.minimo ? Number(f.minimo) : 0,
    maximo: f.maximo ? Number(f.maximo) : null,
    lugar_compra: f.lugar_compra || null,
  };
}

export default function MedicamentosPaciente({
  pacienteId,
  inicial,
  esAdmin = true,
}: {
  pacienteId: string;
  inicial: MedicamentoPaciente[];
  esAdmin?: boolean;
}) {
  const supabase = createClient();
  const [lista, setLista] = useState<MedicamentoPaciente[]>(inicial);
  const [agregando, setAgregando] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormMed>(VACIO);

  function abrirAgregar() {
    setForm(VACIO);
    setEditId(null);
    setAgregando(true);
  }
  function abrirEditar(m: MedicamentoPaciente) {
    setForm(desdeMed(m));
    setAgregando(false);
    setEditId(m.id);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.medicamento_nombre.trim()) return;
    if (editId) {
      const { data } = await supabase
        .from("medicamentos_paciente")
        .update(aPayload(form))
        .eq("id", editId)
        .select()
        .single();
      if (data) setLista((prev) => prev.map((m) => (m.id === editId ? data : m)));
      setEditId(null);
    } else {
      const { data } = await supabase
        .from("medicamentos_paciente")
        .insert({ paciente_id: pacienteId, ...aPayload(form) })
        .select()
        .single();
      if (data) setLista((prev) => [...prev, data]);
      setAgregando(false);
    }
    setForm(VACIO);
  }

  async function ajustar(m: MedicamentoPaciente, delta: number) {
    const nueva = Math.max(0, Number(m.cantidad) + delta);
    const { data } = await supabase
      .from("medicamentos_paciente")
      .update({ cantidad: nueva })
      .eq("id", m.id)
      .select()
      .single();
    if (data) setLista((prev) => prev.map((x) => (x.id === m.id ? data : x)));
  }

  async function eliminar(id: string) {
    await supabase.from("medicamentos_paciente").delete().eq("id", id);
    setLista((prev) => prev.filter((m) => m.id !== id));
  }

  function toggleTurno(t: Turno) {
    setForm((f) => ({
      ...f,
      turnos: f.turnos.includes(t) ? f.turnos.filter((x) => x !== t) : [...f.turnos, t],
    }));
  }

  const Campos = (
    <div className="grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label">Presentación</label>
        <select className="input" value={form.presentacion} onChange={(e) => setForm({ ...form, presentacion: e.target.value })}>
          <option value="">— Selecciona —</option>
          {PRESENTACIONES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Dosis</label>
        <input className="input" placeholder="Ej. 500 mg / 1 tableta" value={form.dosis} onChange={(e) => setForm({ ...form, dosis: e.target.value })} />
      </div>
      <div>
        <label className="label">Frecuencia</label>
        <input className="input" placeholder="Ej. cada 8 horas" value={form.frecuencia} onChange={(e) => setForm({ ...form, frecuencia: e.target.value })} />
      </div>
      <div>
        <label className="label">Lugar de compra</label>
        <input className="input" placeholder="Ej. Farmacia Guadalajara" value={form.lugar_compra} onChange={(e) => setForm({ ...form, lugar_compra: e.target.value })} />
      </div>
      <div className="sm:col-span-2">
        <label className="label">Turnos en que se administra (obligatorio)</label>
        <div className="flex gap-2">
          {TURNOS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => toggleTurno(t.value)}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                form.turnos.includes(t.value) ? "border-marca-300 bg-marca-50 text-marca-700" : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">Déjalo vacío si no es un medicamento programado (solo inventario).</p>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:col-span-2">
        <div>
          <label className="label">Cantidad</label>
          <input type="number" step="0.01" className="input" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
        </div>
        <div>
          <label className="label">Mínimo</label>
          <input type="number" step="0.01" className="input" value={form.minimo} onChange={(e) => setForm({ ...form, minimo: e.target.value })} />
        </div>
        <div>
          <label className="label">Máximo</label>
          <input type="number" step="0.01" className="input" value={form.maximo} onChange={(e) => setForm({ ...form, maximo: e.target.value })} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {esAdmin && !agregando && !editId && (
        <div className="flex justify-end">
          <button onClick={abrirAgregar} className="btn btn-primary">➕ Agregar medicamento</button>
        </div>
      )}

      {esAdmin && agregando && (
        <form onSubmit={guardar} className="card space-y-3 p-5">
          <h3 className="font-semibold text-slate-800">Nuevo medicamento</h3>
          <div>
            <label className="label">Buscar en catálogo (o agregar uno nuevo)</label>
            <MedicamentoAutocomplete
              onSelect={(m) => setForm((f) => ({ ...f, medicamento_nombre: m.nombre, presentacion: f.presentacion || presDeTipo(m.tipo) }))}
            />
            <input className="input mt-2" placeholder="Nombre del medicamento" value={form.medicamento_nombre} onChange={(e) => setForm({ ...form, medicamento_nombre: e.target.value })} />
          </div>
          {Campos}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">Guardar</button>
            <button type="button" onClick={() => setAgregando(false)} className="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        <p className="text-sm text-slate-400">Este paciente no tiene medicamentos.</p>
      ) : (
        <div className="space-y-2">
          {lista.map((m) =>
            editId === m.id ? (
              <form key={m.id} onSubmit={guardar} className="card space-y-3 p-5">
                <div>
                  <label className="label">Medicamento</label>
                  <input className="input" value={form.medicamento_nombre} onChange={(e) => setForm({ ...form, medicamento_nombre: e.target.value })} />
                </div>
                {Campos}
                <div className="flex gap-2">
                  <button type="submit" className="btn btn-primary">Guardar cambios</button>
                  <button type="button" onClick={() => setEditId(null)} className="btn btn-secondary">Cancelar</button>
                </div>
              </form>
            ) : (
              <Fila
                key={m.id}
                m={m}
                esAdmin={esAdmin}
                onAjustar={ajustar}
                onEditar={abrirEditar}
                onEliminar={eliminar}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function Fila({
  m,
  esAdmin,
  onAjustar,
  onEditar,
  onEliminar,
}: {
  m: MedicamentoPaciente;
  esAdmin: boolean;
  onAjustar: (m: MedicamentoPaciente, d: number) => void;
  onEditar: (m: MedicamentoPaciente) => void;
  onEliminar: (id: string) => void;
}) {
  const bajo = Number(m.minimo) > 0 && Number(m.cantidad) <= Number(m.minimo);
  return (
    <div className={`card p-4 ${bajo ? "border-amber-300 bg-amber-50/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800">{m.medicamento_nombre}</span>
            {m.presentacion && <span className="badge bg-sky-100 text-sky-700">{m.presentacion}</span>}
            {m.turnos.length > 0 && <span className="badge bg-marca-100 text-marca-800">Obligatorio</span>}
            {bajo && <span className="badge bg-amber-200 text-amber-900">Resurtir</span>}
          </div>
          <div className="text-xs text-slate-500">
            {[m.dosis, m.frecuencia, m.turnos.length > 0 ? m.turnos.join(", ") : null].filter(Boolean).join(" · ")}
          </div>
          <div className="text-xs text-slate-500">
            Mín {Number(m.minimo)}{m.maximo != null && ` · Máx ${Number(m.maximo)}`}
            {m.lugar_compra && ` · 🛒 ${m.lugar_compra}`}
          </div>
        </div>

        {esAdmin && (
          <>
            <div className="flex items-center gap-1">
              <button onClick={() => onAjustar(m, -1)} className="btn btn-secondary btn-sm">−</button>
              <span className="w-16 text-center text-lg font-bold text-slate-800">
                {Number(m.cantidad)}<span className="ml-1 text-[10px] font-normal text-slate-400">{m.presentacion || ""}</span>
              </span>
              <button onClick={() => onAjustar(m, 1)} className="btn btn-secondary btn-sm">+</button>
            </div>
            <button onClick={() => onEditar(m)} className="btn btn-ghost btn-sm">Editar</button>
            <button onClick={() => onEliminar(m.id)} className="btn btn-danger btn-sm">Eliminar</button>
          </>
        )}
        {!esAdmin && (
          <span className="text-lg font-bold text-slate-800">
            {Number(m.cantidad)}<span className="ml-1 text-xs font-normal text-slate-400">{m.presentacion || ""}</span>
          </span>
        )}
      </div>
    </div>
  );
}
