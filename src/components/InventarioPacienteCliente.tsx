"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS_MEDICAMENTO } from "@/lib/constants";
import type { InventarioPaciente, TipoMedicamento } from "@/lib/types";
import MedicamentoAutocomplete from "./MedicamentoAutocomplete";

const unidadDe = (tipo: TipoMedicamento) =>
  TIPOS_MEDICAMENTO.find((t) => t.value === tipo)?.unidad ?? "unidad";

const tonoTipo: Record<string, string> = {
  pastilla: "bg-sky-100 text-sky-700",
  ml: "bg-violet-100 text-violet-700",
  otro: "bg-slate-100 text-slate-600",
};

export default function InventarioPacienteCliente({
  pacienteId,
  inicial,
}: {
  pacienteId: string;
  inicial: InventarioPaciente[];
}) {
  const supabase = createClient();
  const [items, setItems] = useState<InventarioPaciente[]>(inicial);
  const [mostrarAlta, setMostrarAlta] = useState(false);

  const [nuevo, setNuevo] = useState({
    catalogo_id: null as number | null,
    nombre: "",
    tipo: "pastilla" as TipoMedicamento,
    dosis: "",
    cantidad: "",
    minimo: "",
    maximo: "",
    lugar_compra: "",
  });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    const { data } = await supabase
      .from("inventario_paciente")
      .insert({
        paciente_id: pacienteId,
        catalogo_id: nuevo.catalogo_id,
        nombre: nuevo.nombre.trim(),
        tipo: nuevo.tipo,
        unidad: unidadDe(nuevo.tipo),
        dosis: nuevo.dosis || null,
        cantidad: nuevo.cantidad ? Number(nuevo.cantidad) : 0,
        minimo: nuevo.minimo ? Number(nuevo.minimo) : 0,
        maximo: nuevo.maximo ? Number(nuevo.maximo) : null,
        lugar_compra: nuevo.lugar_compra || null,
      })
      .select()
      .single();
    if (data) {
      setItems((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevo({ catalogo_id: null, nombre: "", tipo: "pastilla", dosis: "", cantidad: "", minimo: "", maximo: "", lugar_compra: "" });
      setMostrarAlta(false);
    }
  }

  async function ajustar(item: InventarioPaciente, delta: number) {
    const nueva = Math.max(0, Number(item.cantidad) + delta);
    const { data } = await supabase
      .from("inventario_paciente")
      .update({ cantidad: nueva })
      .eq("id", item.id)
      .select()
      .single();
    if (data) setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)));
  }

  async function guardarEdicion(id: string, campos: Partial<InventarioPaciente>) {
    const { data } = await supabase.from("inventario_paciente").update(campos).eq("id", id).select().single();
    if (data) setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
  }

  async function eliminar(id: string) {
    await supabase.from("inventario_paciente").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const bajos = items.filter((i) => Number(i.cantidad) <= Number(i.minimo)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="font-semibold text-slate-800">Inventario del paciente</h3>
        {bajos > 0 && <span className="badge bg-amber-100 text-amber-800">{bajos} por resurtir</span>}
        <button onClick={() => setMostrarAlta((v) => !v)} className="btn btn-primary btn-sm ml-auto">
          {mostrarAlta ? "Cancelar" : "➕ Agregar medicamento"}
        </button>
      </div>

      {mostrarAlta && (
        <form onSubmit={crear} className="card space-y-3 p-5">
          <div>
            <label className="label">Buscar en catálogo (o agregar uno nuevo)</label>
            <MedicamentoAutocomplete
              onSelect={(m) => setNuevo((n) => ({ ...n, catalogo_id: m.id, nombre: m.nombre, tipo: m.tipo }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Nombre *</label>
              <input className="input" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value, catalogo_id: null })} />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input" value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value as TipoMedicamento })}>
                {TIPOS_MEDICAMENTO.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Dosis</label>
              <input className="input" placeholder="Ej. 500 mg" value={nuevo.dosis} onChange={(e) => setNuevo({ ...nuevo, dosis: e.target.value })} />
            </div>
            <div>
              <label className="label">Lugar de compra</label>
              <input className="input" placeholder="Ej. Farmacia del Ahorro" value={nuevo.lugar_compra} onChange={(e) => setNuevo({ ...nuevo, lugar_compra: e.target.value })} />
            </div>
            <div>
              <label className="label">Cantidad ({unidadDe(nuevo.tipo)})</label>
              <input type="number" step="0.01" className="input" value={nuevo.cantidad} onChange={(e) => setNuevo({ ...nuevo, cantidad: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Mínimo</label>
                <input type="number" step="0.01" className="input" value={nuevo.minimo} onChange={(e) => setNuevo({ ...nuevo, minimo: e.target.value })} />
              </div>
              <div>
                <label className="label">Máximo</label>
                <input type="number" step="0.01" className="input" value={nuevo.maximo} onChange={(e) => setNuevo({ ...nuevo, maximo: e.target.value })} />
              </div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Guardar</button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-slate-400">Este paciente no tiene medicamentos en inventario.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Fila key={item.id} item={item} onAjustar={ajustar} onGuardar={guardarEdicion} onEliminar={eliminar} />
          ))}
        </div>
      )}
    </div>
  );
}

function Fila({
  item,
  onAjustar,
  onGuardar,
  onEliminar,
}: {
  item: InventarioPaciente;
  onAjustar: (i: InventarioPaciente, d: number) => void;
  onGuardar: (id: string, c: Partial<InventarioPaciente>) => void;
  onEliminar: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [cantidad, setCantidad] = useState(item.cantidad.toString());
  const [minimo, setMinimo] = useState(item.minimo.toString());
  const [maximo, setMaximo] = useState(item.maximo?.toString() ?? "");
  const [dosis, setDosis] = useState(item.dosis ?? "");
  const [lugar, setLugar] = useState(item.lugar_compra ?? "");
  const bajo = Number(item.cantidad) <= Number(item.minimo);

  return (
    <div className={`card p-4 ${bajo ? "border-amber-300 bg-amber-50/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800">{item.nombre}</span>
            <span className={`badge ${tonoTipo[item.tipo]}`}>{item.tipo}</span>
            {item.dosis && <span className="badge bg-slate-100 text-slate-600">{item.dosis}</span>}
            {bajo && <span className="badge bg-amber-200 text-amber-900">Resurtir</span>}
          </div>
          <div className="text-xs text-slate-500">
            Mín: {Number(item.minimo)}{item.maximo != null && ` · Máx: ${Number(item.maximo)}`} {item.unidad}
            {item.lugar_compra && ` · 🛒 ${item.lugar_compra}`}
          </div>
        </div>

        {!editando ? (
          <>
            <div className="flex items-center gap-1">
              <button onClick={() => onAjustar(item, -1)} className="btn btn-secondary btn-sm">−</button>
              <span className="w-20 text-center text-lg font-bold text-slate-800">
                {Number(item.cantidad)}<span className="ml-1 text-xs font-normal text-slate-400">{item.unidad}</span>
              </span>
              <button onClick={() => onAjustar(item, 1)} className="btn btn-secondary btn-sm">+</button>
            </div>
            <button onClick={() => setEditando(true)} className="btn btn-ghost btn-sm">Editar</button>
            <button onClick={() => onEliminar(item.id)} className="btn btn-danger btn-sm">Eliminar</button>
          </>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div><label className="label text-xs">Cantidad</label><input type="number" step="0.01" className="input w-20" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></div>
            <div><label className="label text-xs">Mín</label><input type="number" step="0.01" className="input w-16" value={minimo} onChange={(e) => setMinimo(e.target.value)} /></div>
            <div><label className="label text-xs">Máx</label><input type="number" step="0.01" className="input w-16" value={maximo} onChange={(e) => setMaximo(e.target.value)} /></div>
            <div><label className="label text-xs">Dosis</label><input className="input w-24" value={dosis} onChange={(e) => setDosis(e.target.value)} /></div>
            <div><label className="label text-xs">Lugar</label><input className="input w-28" value={lugar} onChange={(e) => setLugar(e.target.value)} /></div>
            <button
              onClick={() => {
                onGuardar(item.id, {
                  cantidad: Number(cantidad),
                  minimo: Number(minimo),
                  maximo: maximo ? Number(maximo) : null,
                  dosis: dosis || null,
                  lugar_compra: lugar || null,
                });
                setEditando(false);
              }}
              className="btn btn-primary btn-sm"
            >
              Guardar
            </button>
            <button onClick={() => setEditando(false)} className="btn btn-secondary btn-sm">Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );
}
