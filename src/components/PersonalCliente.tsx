"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TURNOS_PERSONAL } from "@/lib/constants";
import { capitalizar } from "@/lib/utils";
import Icon from "@/components/Icon";
import type { Personal } from "@/lib/types";

const VACIO = {
  nombre: "", rol: "enfermero", puesto: "", turno: "", telefono: "", email: "",
  direccion: "", contacto_emergencia: "", contacto_emergencia_tel: "", cedula: "", notas: "",
};
const normalizar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");

export default function PersonalCliente({ inicial }: { inicial: Personal[] }) {
  const supabase = createClient();
  const [lista, setLista] = useState<Personal[]>(inicial);
  const [editId, setEditId] = useState<string | "nuevo" | null>(null);
  const [form, setForm] = useState(VACIO);
  const [busqueda, setBusqueda] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState<string | null>(null);
  const [confirmarEliminar, setConfirmarEliminar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  function abrirNuevo() {
    setError(null);
    setAviso(null);
    setForm(VACIO);
    setEditId("nuevo");
  }
  function abrirEdicion(p: Personal) {
    setError(null);
    setAviso(null);
    setForm({
      nombre: p.nombre ?? "", rol: p.rol ?? "enfermero", puesto: p.puesto ?? "", turno: p.turno ?? "",
      telefono: p.telefono ?? "", email: p.email ?? "", direccion: p.direccion ?? "",
      contacto_emergencia: p.contacto_emergencia ?? "", contacto_emergencia_tel: p.contacto_emergencia_tel ?? "",
      cedula: p.cedula ?? "", notas: p.notas ?? "",
    });
    setEditId(p.id);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando || !editId) return;
    if (!form.nombre.trim()) { setError("Escribe el nombre completo."); return; }
    setGuardando(true);
    setError(null);
    setAviso(null);
    const payload = {
      nombre: form.nombre.trim(), rol: form.rol,
      puesto: form.puesto.trim() || null, turno: form.turno || null,
      telefono: form.telefono.trim() || null, email: form.email.trim() || null,
      direccion: form.direccion.trim() || null,
      contacto_emergencia: form.contacto_emergencia.trim() || null,
      contacto_emergencia_tel: form.contacto_emergencia_tel.trim() || null,
      cedula: form.cedula.trim() || null, notas: form.notas.trim() || null,
    };
    try {
      const { data, error: errorGuardar } = editId === "nuevo"
        ? await supabase.from("personal").insert(payload).select().single()
        : await supabase.from("personal").update(payload).eq("id", editId).select().single();
      if (errorGuardar || !data) {
        setError("No se pudieron guardar los datos. Tus cambios siguen en el formulario; vuelve a intentarlo.");
        return;
      }
      setLista((prev) => (editId === "nuevo" ? [...prev, data] : prev.map((p) => p.id === editId ? data : p)).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
      setEditId(null);
      setAviso("Datos del personal guardados.");
    } catch {
      setError("No se pudo conectar. Tus cambios siguen en el formulario; vuelve a intentarlo.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar(id: string) {
    if (eliminando) return;
    setEliminando(id);
    setError(null);
    setAviso(null);
    try {
      const { data, error: errorEliminar } = await supabase.from("personal").delete().eq("id", id).select("id").maybeSingle();
      if (errorEliminar || !data) { setError("No se pudo eliminar este registro. Puede estar vinculado a actividades o salidas."); return; }
      setLista((prev) => prev.filter((p) => p.id !== id));
      if (editId === id) setEditId(null);
      setConfirmarEliminar(null);
      setAviso("Registro de personal eliminado.");
    } catch {
      setError("No se pudo conectar. El registro sigue en la lista.");
    } finally {
      setEliminando(null);
    }
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
  const filtrados = lista.filter((p) => normalizar(p.nombre).includes(normalizar(busqueda.trim())));

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="w-full sm:max-w-sm"><label htmlFor="buscar-personal" className="label">Buscar personal</label><input id="buscar-personal" type="search" className="input" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre…" /></div>
      <button onClick={abrirNuevo} disabled={guardando || Boolean(eliminando)} className="btn btn-primary"><Icon name="plus" width="18" height="18" />Agregar personal</button>
    </div>
    <p className="text-sm text-slate-500" role="status">{busqueda.trim() ? `${filtrados.length} de ${lista.length}` : lista.length} {lista.length === 1 ? "integrante registrado" : "integrantes registrados"} · {lista.filter((p) => p.activo).length} activos</p>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    {aviso && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{aviso}</p>}

    {editId && <form onSubmit={guardar} className="card space-y-5 p-5 sm:p-6" aria-busy={guardando}>
      <h2 className="section-title">{editId === "nuevo" ? "Nuevo personal" : "Editar personal"}</h2>
      <fieldset disabled={guardando} className="grid gap-4 sm:grid-cols-2">
        {campos.map((c) => <div key={c.k} className={c.full ? "sm:col-span-2" : ""}>
          <label htmlFor={`personal-${c.k}`} className="label">{c.label}</label>
          <input id={`personal-${c.k}`} name={c.k} type={c.type ?? "text"} className="input" required={c.k === "nombre"} value={form[c.k]} onChange={(e) => setForm({ ...form, [c.k]: e.target.value })} />
        </div>)}
        <div><label htmlFor="personal-rol" className="label">Rol en el sistema</label><select id="personal-rol" name="rol" className="input" value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}><option value="enfermero">Enfermero (registra su trabajo)</option><option value="admin">Administrador (acceso total)</option></select></div>
        <div><label htmlFor="personal-turno" className="label">Turno</label><select id="personal-turno" name="turno" className="input" value={form.turno} onChange={(e) => setForm({ ...form, turno: e.target.value })}><option value="">Sin registrar</option>{TURNOS_PERSONAL.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
        <div className="sm:col-span-2"><label htmlFor="personal-notas" className="label">Notas y datos del expediente</label><textarea id="personal-notas" name="notas" className="input min-h-32" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} /></div>
      </fieldset>
      <div className="flex flex-wrap gap-2"><button type="submit" disabled={guardando} className="btn btn-primary">{guardando ? "Guardando…" : "Guardar cambios"}</button><button type="button" disabled={guardando} onClick={() => { setEditId(null); setError(null); }} className="btn btn-secondary">Cancelar</button></div>
    </form>}

    {filtrados.length === 0 ? <div className="card px-6 py-10 text-center text-sm text-slate-500">{lista.length === 0 ? "Sin personal registrado." : "No se encontraron integrantes con ese nombre."}</div> : <div className="grid gap-4 lg:grid-cols-2">
      {filtrados.map((p) => <article key={p.id} className="card min-w-0 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-900">{p.nombre}</h2>{p.rol === "admin" && <span className="badge bg-marca-100 text-marca-800">Admin</span>}{!p.activo && <span className="badge bg-slate-100 text-slate-600">Inactivo</span>}</div><p className="mt-1 text-xs text-slate-500">{[p.puesto, p.turno ? capitalizar(p.turno) : "Turno sin registrar"].filter(Boolean).join(" · ")}</p></div>
          <div className="flex flex-wrap gap-1"><button onClick={() => abrirEdicion(p)} disabled={guardando || Boolean(eliminando)} className="btn btn-ghost btn-sm" aria-label={`Editar a ${p.nombre}`}>Editar</button><button onClick={() => setConfirmarEliminar(p.id)} disabled={guardando || Boolean(eliminando)} className="btn btn-ghost btn-sm" aria-label={`Eliminar a ${p.nombre}`}><Icon name="close" width="16" height="16" /></button></div>
        </div>
        {confirmarEliminar === p.id && <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3"><p className="mb-3 text-sm text-red-700">¿Eliminar el registro de {p.nombre}? Esta acción no se puede deshacer.</p><div className="flex flex-wrap gap-2"><button type="button" onClick={() => eliminar(p.id)} disabled={Boolean(eliminando)} className="btn btn-danger btn-sm">{eliminando === p.id ? "Eliminando…" : "Eliminar registro"}</button><button type="button" onClick={() => setConfirmarEliminar(null)} disabled={Boolean(eliminando)} className="btn btn-secondary btn-sm">Cancelar</button></div></div>}
        <dl className="mt-4 space-y-2 break-words text-sm text-slate-600">
          {p.telefono && <div><dt className="inline font-medium">Teléfono: </dt><dd className="inline">{p.telefono}</dd></div>}
          {p.email && <div><dt className="inline font-medium">Correo: </dt><dd className="inline">{p.email}</dd></div>}
          {p.direccion && <div><dt className="inline font-medium">Dirección: </dt><dd className="inline">{p.direccion}</dd></div>}
          {p.cedula && <div><dt className="inline font-medium">Cédula: </dt><dd className="inline">{p.cedula}</dd></div>}
          {(p.contacto_emergencia || p.contacto_emergencia_tel) && <div><dt className="inline font-medium">Emergencia: </dt><dd className="inline">{[p.contacto_emergencia, p.contacto_emergencia_tel].filter(Boolean).join(" · ")}</dd></div>}
        </dl>
        {p.notas && <details className="mt-4 border-t border-slate-100 pt-3"><summary className="min-h-11 py-2 text-sm font-semibold text-marca-700">Datos del expediente</summary><p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-slate-600">{p.notas}</p></details>}
      </article>)}
    </div>}
  </div>;
}
