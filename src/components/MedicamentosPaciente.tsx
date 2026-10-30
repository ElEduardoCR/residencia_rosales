"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TURNOS, PRESENTACIONES } from "@/lib/constants";
import type { MedicamentoPaciente, Turno } from "@/lib/types";
import { actualizarNotasVerificacion, esRegistroDocumental, existenciasSinVerificar, indicacionSinRevisar } from "@/lib/medication-verification";
import { medicamentoProgramado } from "@/lib/medication-schedule";
import { fechaEnZona } from "@/lib/utils";
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
  notas: string;
  existencias_verificadas: boolean;
  dosis_revisadas: boolean;
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
  notas: "",
  existencias_verificadas: false,
  dosis_revisadas: false,
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
    cantidad: existenciasSinVerificar(m.notas) ? "" : m.cantidad?.toString() ?? "0",
    minimo: m.minimo?.toString() ?? "0",
    maximo: m.maximo?.toString() ?? "",
    lugar_compra: m.lugar_compra ?? "",
    notas: m.notas ?? "",
    existencias_verificadas: !existenciasSinVerificar(m.notas),
    dosis_revisadas: !indicacionSinRevisar(m.notas),
  };
}

function aPayload(f: FormMed, original: MedicamentoPaciente | undefined) {
  return {
    medicamento_nombre: f.medicamento_nombre.trim(),
    presentacion: f.presentacion || null,
    dosis: f.dosis || null,
    frecuencia: f.frecuencia || null,
    turnos: f.turnos,
    ...(original ? {} : { cantidad: 0 }),
    minimo: f.minimo ? Number(f.minimo) : 0,
    maximo: f.maximo ? Number(f.maximo) : null,
    lugar_compra: f.lugar_compra || null,
    notas: actualizarNotasVerificacion({
      notas: original ? f.notas : `${f.notas}\nExistencias no verificadas.`.trim(),
      notasOriginales: original?.notas ?? null,
      existenciasVerificadas: Boolean(original && original.stock_verificado_at && !existenciasSinVerificar(original.notas)),
      dosisYHorariosRevisados: f.dosis_revisadas,
      fecha: fechaEnZona("America/Chihuahua"),
    }),
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
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [actualizacionNecesaria, setActualizacionNecesaria] = useState(false);
  const medicamentoEditando = lista.find(m => m.id === editId);
  const documental = agregando || esRegistroDocumental(medicamentoEditando?.notas) || esRegistroDocumental(form.notas);

  function abrirAgregar() {
    setActualizacionNecesaria(false);
    setError(null);
    setForm(VACIO);
    setEditId(null);
    setAgregando(true);
  }
  function abrirEditar(m: MedicamentoPaciente) {
    setActualizacionNecesaria(false);
    setError(null);
    setForm(desdeMed(m));
    setAgregando(false);
    setEditId(m.id);
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (guardando || actualizacionNecesaria) return;
    if (!form.medicamento_nombre.trim()) return setError("Escribe el nombre del medicamento.");
    if ([form.minimo, form.maximo].some(v => v && (!Number.isFinite(Number(v)) || Number(v) < 0))) {
      return setError("Las existencias y los límites deben ser números positivos o cero.");
    }
    setGuardando(true);
    setError(null);
    try {
      const payload = aPayload(form, medicamentoEditando);
      let query = editId
        ? supabase.from("medicamentos_paciente").update(payload).eq("id", editId)
        : supabase.from("medicamentos_paciente").insert({ paciente_id: pacienteId, ...payload });
      if (editId) {
        query = medicamentoEditando?.stock_verificado_at
          ? query.eq("stock_verificado_at", medicamentoEditando.stock_verificado_at)
          : query.is("stock_verificado_at", null);
      }
      const { data, error: fallo } = await query.select().maybeSingle();
      if (fallo) throw new Error("No se pudo guardar el medicamento. Revisa la conexión y tus permisos.");
      if (!data) {
        setActualizacionNecesaria(true);
        throw new Error("El medicamento cambió mientras lo editabas. Actualiza sus datos antes de guardar; tus cambios siguen en el formulario.");
      }
      setLista(prev => editId ? prev.map(m => m.id === editId ? data : m) : [...prev, data]);
      setEditId(null);
      setAgregando(false);
      setForm(VACIO);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar el medicamento.");
    } finally { setGuardando(false); }
  }

  async function actualizarDatos() {
    if (guardando) return;
    setGuardando(true);
    try {
      const { data, error: fallo } = await supabase.from("medicamentos_paciente").select("*").eq("paciente_id", pacienteId).eq("activo", true).order("medicamento_nombre");
      if (fallo || !data) throw new Error("No se pudieron actualizar los datos. Intenta nuevamente.");
      setLista(data);
      if (editId && !data.some(m => m.id === editId)) {
        setEditId(null);
        setError("Este medicamento ya no está activo. Revisa la lista actualizada.");
      } else {
        setError("Datos actualizados. Revisa la indicación y vuelve a guardar tus cambios.");
      }
      setActualizacionNecesaria(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron actualizar los datos.");
    } finally { setGuardando(false); }
  }

  async function eliminar(id: string) {
    if (!window.confirm("¿Retirar este medicamento de la lista activa? Se conservará su registro.")) return;
    const { error: fallo } = await supabase.from("medicamentos_paciente").update({ activo: false }).eq("id", id);
    if (fallo) return setError("No se pudo retirar el medicamento.");
    setLista(prev => prev.filter(m => m.id !== id));
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
        <label className="label">Turnos de administración programada</label>
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
        {documental && <label className="mt-3 flex min-h-11 items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.dosis_revisadas} onChange={e => setForm({ ...form, dosis_revisadas: e.target.checked })} />
          Dosis y horarios revisados
        </label>}
        {documental && !form.dosis_revisadas && <p className="text-xs text-amber-800">Puedes guardar la información pendiente de revisión. Su administración programada permanecerá deshabilitada.</p>}
      </div>
      <div className="sm:col-span-2">
        <label className="label" htmlFor="med-notas">Fuente e indicaciones del documento</label>
        <textarea id="med-notas" className="input min-h-28" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:col-span-2">
        <div>
          <label className="label">Mínimo</label>
          <input type="number" step="0.01" className="input" value={form.minimo} onChange={(e) => setForm({ ...form, minimo: e.target.value })} />
        </div>
        <div>
          <label className="label">Máximo</label>
          <input type="number" step="0.01" className="input" value={form.maximo} onChange={(e) => setForm({ ...form, maximo: e.target.value })} />
        </div>
      </div>
      <p className="text-sm text-slate-600 sm:col-span-2">Las existencias se actualizan en <Link href="/medicamentos" className="font-semibold text-marca-700 underline">Medicamentos → Registrar conteo</Link>, con fecha, responsable y motivo.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700"><p>{error}</p>{actualizacionNecesaria && <button type="button" className="btn btn-secondary mt-3" disabled={guardando} onClick={actualizarDatos}>{guardando ? "Actualizando…" : "Actualizar datos"}</button>}</div>}
      {lista.some(m => m.notas?.includes("Requiere revisión documental")) && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Indicaciones transcritas de los documentos. Verifica dosis, unidades y horarios antes de programar su administración.</p>}
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
            <button type="submit" disabled={guardando || actualizacionNecesaria} className="btn btn-primary">Guardar</button>
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
                  <button type="submit" disabled={guardando || actualizacionNecesaria} className="btn btn-primary">Guardar cambios</button>
                  <button type="button" onClick={() => setEditId(null)} className="btn btn-secondary">Cancelar</button>
                </div>
              </form>
            ) : (
              <Fila
                key={m.id}
                m={m}
                esAdmin={esAdmin}
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
  onEditar,
  onEliminar,
}: {
  m: MedicamentoPaciente;
  esAdmin: boolean;
  onEditar: (m: MedicamentoPaciente) => void;
  onEliminar: (id: string) => void;
}) {
  const sinConteo = !m.stock_verificado_at || existenciasSinVerificar(m.notas);
  const bajo = !sinConteo && Number(m.minimo) > 0 && Number(m.cantidad) <= Number(m.minimo);
  return (
    <div className={`card p-4 ${bajo ? "border-amber-300 bg-amber-50/40" : ""}`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-slate-800">{m.medicamento_nombre}</span>
            {m.presentacion && <span className="badge bg-sky-100 text-sky-700">{m.presentacion}</span>}
            {medicamentoProgramado(m) && <span className="badge bg-marca-100 text-marca-800">Programado</span>}
            {m.notas?.includes("Requiere revisión documental") && <span className="badge bg-amber-100 text-amber-900">Revisar indicación</span>}
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

        {m.notas && <details className="w-full text-sm text-slate-600"><summary className="cursor-pointer font-medium text-marca-700">Ver indicación original y fuente</summary><p className="mt-2 whitespace-pre-line leading-relaxed">{m.notas}</p></details>}
        {sinConteo && <span className="text-xs text-slate-500">Existencias sin verificar</span>}
        {esAdmin && (
          <>
            <Link href="/medicamentos" className="btn btn-secondary btn-sm">{sinConteo ? "Registrar conteo" : `${Number(m.cantidad)} ${m.presentacion || "unidades"} · ver conteo`}</Link>
            <button onClick={() => onEditar(m)} className="btn btn-ghost btn-sm">Editar</button>
            <button onClick={() => onEliminar(m.id)} className="btn btn-danger btn-sm">Eliminar</button>
          </>
        )}
        {!esAdmin && (
          <span className="text-lg font-bold text-slate-800">
            {sinConteo ? "—" : Number(m.cantidad)}<span className="ml-1 text-xs font-normal text-slate-400">{m.presentacion || ""}</span>
          </span>
        )}
      </div>
    </div>
  );
}
