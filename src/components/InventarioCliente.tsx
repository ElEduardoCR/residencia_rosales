"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TIPOS_MEDICAMENTO } from "@/lib/constants";
import type { InventarioMedicamento, TipoMedicamento } from "@/lib/types";
import MedicamentoAutocomplete from "./MedicamentoAutocomplete";

const unidadDe = (tipo: TipoMedicamento) =>
  TIPOS_MEDICAMENTO.find((t) => t.value === tipo)?.unidad ?? "unidad";

export default function InventarioCliente({ inicial }: { inicial: InventarioMedicamento[] }) {
  const supabase = createClient();
  const [items, setItems] = useState<InventarioMedicamento[]>(inicial);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [filtro, setFiltro] = useState("");

  // alta
  const [nuevo, setNuevo] = useState({
    catalogo_id: null as number | null,
    nombre: "",
    tipo: "pastilla" as TipoMedicamento,
    cantidad: "",
    minimo: "",
    ubicacion: "",
  });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nuevo.nombre.trim()) return;
    const { data } = await supabase
      .from("inventario_medicamentos")
      .insert({
        catalogo_id: nuevo.catalogo_id,
        nombre: nuevo.nombre.trim(),
        tipo: nuevo.tipo,
        unidad: unidadDe(nuevo.tipo),
        cantidad: nuevo.cantidad ? Number(nuevo.cantidad) : 0,
        minimo: nuevo.minimo ? Number(nuevo.minimo) : 0,
        ubicacion: nuevo.ubicacion || null,
      })
      .select()
      .single();
    if (data) {
      setItems((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
      setNuevo({ catalogo_id: null, nombre: "", tipo: "pastilla", cantidad: "", minimo: "", ubicacion: "" });
      setMostrarAlta(false);
    }
  }

  async function ajustar(item: InventarioMedicamento, delta: number) {
    const nueva = Math.max(0, Number(item.cantidad) + delta);
    const { data } = await supabase
      .from("inventario_medicamentos")
      .update({ cantidad: nueva })
      .eq("id", item.id)
      .select()
      .single();
    if (data) {
      setItems((prev) => prev.map((i) => (i.id === item.id ? data : i)));
      await supabase.from("inventario_movimientos").insert({
        inventario_id: item.id,
        tipo: delta > 0 ? "entrada" : "salida",
        cantidad: Math.abs(delta),
      });
    }
  }

  async function guardarEdicion(id: string, campos: Partial<InventarioMedicamento>) {
    const { data } = await supabase.from("inventario_medicamentos").update(campos).eq("id", id).select().single();
    if (data) setItems((prev) => prev.map((i) => (i.id === id ? data : i)));
  }

  async function eliminar(id: string) {
    await supabase.from("inventario_medicamentos").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  const visibles = items.filter((i) => i.nombre.toLowerCase().includes(filtro.toLowerCase()));
  const bajos = items.filter((i) => Number(i.cantidad) <= Number(i.minimo)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Buscar en inventario…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
        {bajos > 0 && <span className="badge bg-amber-100 text-amber-800">{bajos} por resurtir</span>}
        <button onClick={() => setMostrarAlta((v) => !v)} className="btn btn-primary ml-auto">
          {mostrarAlta ? "Cancelar" : "➕ Dar de alta"}
        </button>
      </div>

      {mostrarAlta && (
        <form onSubmit={crear} className="card space-y-3 p-5">
          <h3 className="font-semibold text-slate-800">Nuevo medicamento</h3>
          <div>
            <label className="label">Buscar en catálogo</label>
            <MedicamentoAutocomplete
              onSelect={(m) =>
                setNuevo((n) => ({ ...n, catalogo_id: m.id, nombre: m.nombre, tipo: m.tipo }))
              }
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
              <label className="label">Cantidad inicial ({unidadDe(nuevo.tipo)})</label>
              <input type="number" step="0.01" className="input" value={nuevo.cantidad} onChange={(e) => setNuevo({ ...nuevo, cantidad: e.target.value })} />
            </div>
            <div>
              <label className="label">Mínimo (resurtir cuando baje a)</label>
              <input type="number" step="0.01" className="input" value={nuevo.minimo} onChange={(e) => setNuevo({ ...nuevo, minimo: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Ubicación</label>
              <input className="input" placeholder="Ej. Gabinete A" value={nuevo.ubicacion} onChange={(e) => setNuevo({ ...nuevo, ubicacion: e.target.value })} />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">Guardar</button>
        </form>
      )}

      {visibles.length === 0 ? (
        <p className="text-sm text-slate-400">Sin medicamentos en inventario.</p>
      ) : (
        <div className="space-y-2">
          {visibles.map((item) => (
            <FilaInventario
              key={item.id}
              item={item}
              onAjustar={ajustar}
              onGuardar={guardarEdicion}
              onEliminar={eliminar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaInventario({
  item,
  onAjustar,
  onGuardar,
  onEliminar,
}: {
  item: InventarioMedicamento;
  onAjustar: (i: InventarioMedicamento, d: number) => void;
  onGuardar: (id: string, c: Partial<InventarioMedicamento>) => void;
  onEliminar: (id: string) => void;
}) {
  const [editando, setEditando] = useState(false);
  const [cantidad, setCantidad] = useState(item.cantidad.toString());
  const [minimo, setMinimo] = useState(item.minimo.toString());
  const [ubicacion, setUbicacion] = useState(item.ubicacion ?? "");
  const bajo = Number(item.cantidad) <= Number(item.minimo);

  const tonoTipo: Record<string, string> = {
    pastilla: "bg-sky-100 text-sky-700",
    ml: "bg-violet-100 text-violet-700",
    otro: "bg-slate-100 text-slate-600",
  };

  return (
    <div className={`card p-4 ${bajo ? "border-amber-300 bg-amber-50/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-800">{item.nombre}</span>
            <span className={`badge ${tonoTipo[item.tipo]}`}>{item.tipo}</span>
            {bajo && <span className="badge bg-amber-200 text-amber-900">Resurtir</span>}
          </div>
          <div className="text-xs text-slate-500">
            Mínimo: {Number(item.minimo)} {item.unidad}
            {item.ubicacion && ` · ${item.ubicacion}`}
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
            <div>
              <label className="label text-xs">Cantidad</label>
              <input type="number" step="0.01" className="input w-24" value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Mínimo</label>
              <input type="number" step="0.01" className="input w-24" value={minimo} onChange={(e) => setMinimo(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Ubicación</label>
              <input className="input w-32" value={ubicacion} onChange={(e) => setUbicacion(e.target.value)} />
            </div>
            <button
              onClick={() => {
                onGuardar(item.id, { cantidad: Number(cantidad), minimo: Number(minimo), ubicacion: ubicacion || null });
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
