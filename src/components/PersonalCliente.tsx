"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TURNOS_PERSONAL } from "@/lib/constants";
import { capitalizar } from "@/lib/utils";
import type { Personal } from "@/lib/types";

const VACIO = {
  nombre: "", puesto: "", turno: "", telefono: "", email: "",
  direccion: "", contacto_emergencia: "", contacto_emergencia_tel: "", cedula: "", notas: "",
};

export default function PersonalCliente({ inicial }: { inicial: Personal[] }) {
  const supabase = createClient();
  const [lista, setLista] = useState<Personal[]>(inicial);
  const [editId, setEditId] = useState<string | "nuevo" | null>(null);
  const [form, setForm] = useState(VACIO);

  function abrirNuevo() {
    setForm(VACIO);
    setEditId("nuevo");
  }
  function abrirEdicion(p: Personal) {
    setForm({
      nombre: p.nombre ?? "", puesto: p.puesto ?? "", turno: p.turno ?? "",
      telefono: p.telefono ?? "", email: p.email ?? "", direccion: p.direccion ?? "",
      contacto_emergencia: p.contacto_emergencia ?? "", contacto_emergencia_tel: p.contacto_emergencia_tel ?? "",
      cedula: p.cedula ?? "", notas: p.notas ?? "",
    });
    setEditId(p.id);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      nombre: form.nombre.trim(),
      puesto: form.puesto || null,
      turno: form.turno || null,
      telefono: form.telefono || null,
      email: form.email || null,
      direccion: form.direccion || null,
      contacto_emergencia: form.contacto_emergencia || null,
      contacto_emergencia_tel: form.contacto_emergencia_tel || null,
      cedula: form.cedula || null,
      notas: form.notas || null,
    };
    if (editId === "nuevo") {
      const { data } = await supabase.from("personal").insert(payload).select().single();
      if (data) setLista((prev) => [...prev, data].sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } else if (editId) {
      const { data } = await supabase.from("personal").update(payload).eq("id", editId).select().single();
      if (data) setLista((prev) => prev.map((p) => (p.id === editId ? data : p)));
    }
    setEditId(null);
  }

  async function eliminar(id: string) {
    await supabase.from("personal").delete().eq("id", id);
    setLista((prev) => prev.filter((p) => p.id !== id));
  }

  const campos: { k: keyof typeof VACIO; label: string; type?: string; full?: boolean }[] = [
    { k: "nombre", label: "Nombre completo *", full: true },
    { k: "puesto", label: "Puesto" },
    { k: "cedula", label: "Cédula profesional" },
    { k: "telefono", label: "Teléfono", type: "tel" },
    { k: "email", label: "Correo", type: "email" },
    { k: "direccion", label: "Dirección", full: true },
    { k: "contacto_emergencia", label: "Contacto de emergencia" },
    { k: "contacto_emergencia_tel", label: "Tel. de emergencia", type: "tel" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={abrirNuevo} className="btn btn-primary">➕ Agregar personal</button>
      </div>

      {editId && (
        <form onSubmit={guardar} className="card space-y-3 p-5">
          <h3 className="font-semibold text-slate-800">
            {editId === "nuevo" ? "Nuevo personal" : "Editar personal"}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {campos.map((c) => (
              <div key={c.k} className={c.full ? "sm:col-span-2" : ""}>
                <label className="label">{c.label}</label>
                <input
                  type={c.type ?? "text"}
                  className="input"
                  required={c.k === "nombre"}
                  value={form[c.k]}
                  onChange={(e) => setForm({ ...form, [c.k]: e.target.value })}
                />
              </div>
            ))}
            <div>
              <label className="label">Turno</label>
              <select className="input" value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })}>
                <option value="">—</option>
                {TURNOS_PERSONAL.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notas</label>
              <textarea className="input min-h-16" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary">Guardar</button>
            <button type="button" onClick={() => setEditId(null)} className="btn btn-secondary">Cancelar</button>
          </div>
        </form>
      )}

      {lista.length === 0 ? (
        <p className="text-sm text-slate-400">Sin personal registrado.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {lista.map((p) => (
            <div key={p.id} className="card p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium text-slate-900">{p.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {[p.puesto, p.turno && capitalizar(p.turno)].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => abrirEdicion(p)} className="btn btn-ghost btn-sm">Editar</button>
                  <button onClick={() => eliminar(p.id)} className="btn btn-danger btn-sm">✕</button>
                </div>
              </div>
              <div className="mt-2 space-y-0.5 text-sm text-slate-600">
                {p.telefono && <div>📞 {p.telefono}</div>}
                {p.email && <div>✉️ {p.email}</div>}
                {p.direccion && <div>📍 {p.direccion}</div>}
                {p.contacto_emergencia && (
                  <div className="text-xs text-slate-500">
                    🆘 {p.contacto_emergencia} {p.contacto_emergencia_tel && `· ${p.contacto_emergencia_tel}`}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
