"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { medicamentoProgramado, puedeRegistrarTurno } from "@/lib/medication-schedule";
import { createClient } from "@/lib/supabase/client";
import { TURNOS, COMIDAS_DIA, ML_POR_VASO, ZONA_HORARIA } from "@/lib/constants";
import { fechaEnZona, capitalizar } from "@/lib/utils";
import type {
  Turno,
  RegistroTurno,
  RegistroAlimentacion,
  AdministracionMedicamento,
  MedicamentoPaciente,
} from "@/lib/types";

type PersonalMin = { id: string; nombre: string };

type RegistroProps = { pacienteId: string; personal: PersonalMin[]; obligatorios: MedicamentoPaciente[] };

export default function RegistroDiario(props: RegistroProps) {
  const [fecha, setFecha] = useState(fechaEnZona(ZONA_HORARIA));
  return <RegistroDelDia key={`${props.pacienteId}:${fecha}`} {...props} fecha={fecha} setFecha={setFecha} />;
}

function RegistroDelDia({ pacienteId, personal, obligatorios, fecha, setFecha }: RegistroProps & { fecha: string; setFecha: (value: string) => void }) {
  const [supabase] = useState(createClient);
  const [cargando, setCargando] = useState(true);
  const [falloCarga, setFalloCarga] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const operacion = useRef(false);
  const [enfermeroDefault, setEnfermeroDefault] = useState<string>("");

  const [turnos, setTurnos] = useState<Record<Turno, RegistroTurno | null>>({
    matutino: null,
    vespertino: null,
    nocturno: null,
  });
  const [alim, setAlim] = useState<RegistroAlimentacion | null>(null);
  const [admins, setAdmins] = useState<AdministracionMedicamento[]>([]);

  useEffect(() => {
    let vigente = true;
    const abort = new AbortController();
    Promise.all([
      supabase.from("registros_turno").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha).abortSignal(abort.signal),
      supabase.from("registros_alimentacion").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha).abortSignal(abort.signal).maybeSingle(),
      supabase.from("administracion_medicamentos").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha).abortSignal(abort.signal),
    ]).then(([rt, ra, am]) => {
      if (!vigente) return;
      if (rt.error || ra.error || am.error) {
        setFalloCarga(true);
        setError("No se pudo cargar el registro completo. Actualiza la página antes de registrar nuevas actividades.");
      } else {
        const map: Record<Turno, RegistroTurno | null> = { matutino: null, vespertino: null, nocturno: null };
        (rt.data ?? []).forEach((r) => (map[r.turno as Turno] = r));
        setTurnos(map); setAlim(ra.data ?? null); setAdmins(am.data ?? []);
      }
      setCargando(false);
    }, () => {
      if (!vigente) return;
      setFalloCarga(true); setCargando(false); setError("No se pudo cargar el registro. Revisa tu conexión y actualiza la página.");
    });
    return () => { vigente = false; abort.abort(); };
  }, [supabase, pacienteId, fecha]);

  async function registrar(accion: () => Promise<void>) {
    if (operacion.current || cargando || falloCarga) return;
    operacion.current = true; setGuardando(true); setError("");
    try { await accion(); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el cambio. Intenta nuevamente."); }
    finally { operacion.current = false; setGuardando(false); }
  }

  function cambiarDia(delta: number) {
    const d = new Date(`${fecha}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    setFecha(d.toISOString().slice(0, 10));
  }

  // --- Evacuaciones / orina por turno ---
  async function guardarTurno(turno: Turno, campos: Partial<RegistroTurno>) {
    await registrar(async () => {
    const actual = turnos[turno];
    const payload = {
      paciente_id: pacienteId,
      fecha,
      turno,
      evacuaciones: actual?.evacuaciones ?? 0,
      orina: actual?.orina ?? 0,
      enfermero_id: actual?.enfermero_id ?? (enfermeroDefault || null),
      ...campos,
    };
    const { data, error: fallo } = await supabase
      .from("registros_turno")
      .upsert(payload, { onConflict: "paciente_id,fecha,turno" })
      .select()
      .single();
    if (fallo || !data) throw new Error("No se pudo guardar el registro del turno.");
    setTurnos((prev) => ({ ...prev, [turno]: data }));
    });
  }

  // --- Alimentación ---
  async function guardarAlim(campos: Partial<RegistroAlimentacion>) {
    await registrar(async () => {
    const payload = {
      paciente_id: pacienteId,
      fecha,
      almuerzo: alim?.almuerzo ?? false,
      comida: alim?.comida ?? false,
      cena: alim?.cena ?? false,
      colacion_matutina: alim?.colacion_matutina ?? false,
      colacion_vespertina: alim?.colacion_vespertina ?? false,
      vasos_agua: alim?.vasos_agua ?? 0,
      enfermero_id: alim?.enfermero_id ?? (enfermeroDefault || null),
      ...campos,
    };
    const { data, error: fallo } = await supabase
      .from("registros_alimentacion")
      .upsert(payload, { onConflict: "paciente_id,fecha" })
      .select()
      .single();
    if (fallo || !data) throw new Error("No se pudo guardar la alimentación.");
    setAlim(data);
    });
  }

  // --- Administración obligatoria (toggle por turno) ---
  function adminDe(nombre: string, turno: Turno, tipo: "obligatorio" | "extra") {
    return admins.find(
      (a) => a.medicamento_nombre === nombre && a.turno === turno && a.tipo === tipo,
    );
  }

  async function toggleObligatorio(med: MedicamentoPaciente, turno: Turno) {
    if (!puedeRegistrarTurno(med, turno)) return setError("La indicación debe revisarse y tener un turno programado antes de registrar su administración.");
    await registrar(async () => {
    const existente = adminDe(med.medicamento_nombre, turno, "obligatorio");
    if (existente) {
      const { data: borradas, error: fallo } = await supabase.from("administracion_medicamentos").delete().eq("id", existente.id).select("id");
      if (fallo || !borradas?.length) throw new Error("No se pudo quitar la administración registrada.");
      setAdmins((prev) => prev.filter((a) => a.id !== existente.id));
    } else {
      const { data, error: fallo } = await supabase
        .from("administracion_medicamentos")
        .insert({
          paciente_id: pacienteId,
          fecha,
          turno,
          inventario_id: med.inventario_id,
          medicamento_nombre: med.medicamento_nombre,
          tipo: "obligatorio",
          dosis: med.dosis,
          enfermero_id: enfermeroDefault || null,
        })
        .select()
        .single();
      if (fallo || !data) throw new Error("No se pudo guardar la administración del medicamento.");
      setAdmins((prev) => [...prev, data]);
    }
    });
  }

  // --- Administración extra ---
  const [extra, setExtra] = useState({ nombre: "", dosis: "", motivo: "", turno: "matutino" as Turno });
  async function agregarExtra(e: React.FormEvent) {
    e.preventDefault();
    if (!extra.nombre.trim() || !extra.motivo.trim()) return setError("Indica el medicamento y el motivo de la administración extra.");
    await registrar(async () => {
    const { data, error: fallo } = await supabase
      .from("administracion_medicamentos")
      .insert({
        paciente_id: pacienteId,
        fecha,
        turno: extra.turno,
        medicamento_nombre: extra.nombre.trim(),
        tipo: "extra",
        dosis: extra.dosis || null,
        motivo: extra.motivo || null,
        enfermero_id: enfermeroDefault || null,
      })
      .select()
      .single();
    if (fallo || !data) throw new Error("No se pudo guardar la administración extra.");
    if (data) {
      setAdmins((prev) => [...prev, data]);
      setExtra({ nombre: "", dosis: "", motivo: "", turno: "matutino" });
    }
    });
  }

  async function borrarAdmin(id: string) {
    await registrar(async () => {
      const { data: borradas, error: fallo } = await supabase.from("administracion_medicamentos").delete().eq("id", id).select("id");
      if (fallo || !borradas?.length) throw new Error("No se pudo quitar la administración registrada.");
      setAdmins((prev) => prev.filter((a) => a.id !== id));
    });
  }

  const extras = admins.filter((a) => a.tipo === "extra");
  const vasos = alim?.vasos_agua ?? 0;
  const programados = obligatorios.filter(medicamentoProgramado);
  const pendientes = obligatorios.filter((med) => !medicamentoProgramado(med));

  return (
    <div className="space-y-5">
      {/* Selector de fecha y enfermero */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Fecha</label>
          <div className="flex items-center gap-1">
            <button onClick={() => cambiarDia(-1)} className="btn btn-secondary btn-sm">←</button>
            <input type="date" className="input w-auto" value={fecha} onChange={(e) => { if (e.target.value) setFecha(e.target.value); }} />
            <button onClick={() => cambiarDia(1)} className="btn btn-secondary btn-sm">→</button>
          </div>
        </div>
        <div className="min-w-48">
          <label className="label">Enfermero responsable (por defecto)</label>
          <select className="input" value={enfermeroDefault} onChange={(e) => setEnfermeroDefault(e.target.value)}>
            <option value="">— Selecciona —</option>
            {personal.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
        </div>
      </div>

      {cargando && <p role="status" className="text-sm text-slate-500">Cargando registro del día…</p>}
      {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <fieldset disabled={cargando || falloCarga || guardando} className="space-y-5 disabled:opacity-70">
      {/* Evacuaciones y orina por turno */}
      <div className="card p-5">
        <h3 className="mb-3 font-semibold text-slate-800">Evacuaciones y orina</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {TURNOS.map((t) => {
            const r = turnos[t.value];
            return (
              <div key={t.value} className="rounded-lg border border-slate-200 p-3">
                <div className="mb-2 text-sm font-medium text-marca-700">{t.label}</div>
                <div className="grid grid-cols-2 gap-2">
                  <NumField
                    label="Evacuaciones"
                    value={r?.evacuaciones ?? 0}
                    onChange={(v) => guardarTurno(t.value, { evacuaciones: v })}
                  />
                  <NumField
                    label="Orina"
                    value={r?.orina ?? 0}
                    onChange={(v) => guardarTurno(t.value, { orina: v })}
                  />
                </div>
                <div className="mt-2">
                  <select
                    className="input text-xs"
                    value={r?.enfermero_id ?? ""}
                    onChange={(e) => guardarTurno(t.value, { enfermero_id: e.target.value || null })}
                  >
                    <option value="">Enfermero que verificó…</option>
                    {personal.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Alimentación e hidratación */}
      <div className="card p-5">
        <h3 className="mb-3 font-semibold text-slate-800">Alimentación e hidratación</h3>
        <div className="flex flex-wrap gap-2">
          {COMIDAS_DIA.map((c) => {
            const activo = (alim?.[c.key] as boolean) ?? false;
            return (
              <button
                key={c.key}
                onClick={() => guardarAlim({ [c.key]: !activo } as Partial<RegistroAlimentacion>)}
                className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                  activo
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                {activo ? "✓ " : ""}{c.label}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-slate-600">💧 Vasos de agua:</span>
          <button onClick={() => guardarAlim({ vasos_agua: Math.max(0, vasos - 1) })} className="btn btn-secondary btn-sm">−</button>
          <span className="w-8 text-center font-semibold">{vasos}</span>
          <button onClick={() => guardarAlim({ vasos_agua: vasos + 1 })} className="btn btn-secondary btn-sm">+</button>
          <span className="text-sm text-slate-400">= {vasos * ML_POR_VASO} ml</span>
        </div>
      </div>

      {/* Medicamentos obligatorios */}
      <div className="card p-5">
        <h3 className="mb-1 font-semibold text-slate-800">Medicamentos programados</h3>
        <p className="mb-3 text-xs text-slate-500">Marca el turno en que se administró cada medicamento.</p>
        {pendientes.length > 0 && <div className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800"><p>{pendientes.length} medicamento(s) sin programación o pendientes de revisión. No se habilitan como administración programada.</p><Link href={`/pacientes/${pacienteId}?tab=medicamentos`} className="mt-2 inline-block font-medium underline">Revisar medicamentos e indicaciones</Link></div>}
        {programados.length === 0 ? (
          <p className="text-sm text-slate-400">No hay medicamentos revisados con turnos programados.</p>
        ) : (
          <div className="space-y-2">
            {programados.map((med) => {
              const turnosMed = med.turnos;
              return (
                <div key={med.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div>
                    <div className="font-medium text-slate-800">{med.medicamento_nombre}</div>
                    {med.dosis && <div className="text-xs text-slate-500">{med.dosis}</div>}
                  </div>
                  <div className="flex gap-1">
                    {TURNOS.map((t) => {
                      const aplica = turnosMed.includes(t.value);
                      const dado = !!adminDe(med.medicamento_nombre, t.value, "obligatorio");
                      return (
                        <button
                          key={t.value}
                          disabled={!aplica}
                          onClick={() => toggleObligatorio(med, t.value)}
                          title={t.label}
                          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
                            !aplica
                              ? "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300"
                              : dado
                                ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                : "border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {dado ? "✓ " : ""}{t.label[0]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Medicamento extra */}
      <div className="card p-5">
        <h3 className="mb-1 font-semibold text-slate-800">Medicamento extra</h3>
        <p className="mb-3 text-xs text-slate-500">Fuera del tratamiento obligatorio. Indica para qué se usó.</p>
        <form onSubmit={agregarExtra} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <input className="input lg:col-span-2" placeholder="Medicamento" value={extra.nombre} onChange={(e) => setExtra({ ...extra, nombre: e.target.value })} />
          <input className="input" placeholder="Dosis" value={extra.dosis} onChange={(e) => setExtra({ ...extra, dosis: e.target.value })} />
          <select className="input" value={extra.turno} onChange={(e) => setExtra({ ...extra, turno: e.target.value as Turno })}>
            {TURNOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <input className="input lg:col-span-4" placeholder="¿Para qué se usó? (motivo)" value={extra.motivo} onChange={(e) => setExtra({ ...extra, motivo: e.target.value })} />
          <button type="submit" className="btn btn-primary">Agregar</button>
        </form>

        {extras.length > 0 && (
          <div className="mt-4 space-y-2">
            {extras.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-800">{a.medicamento_nombre}</span>
                  {a.dosis && <span className="text-slate-500"> · {a.dosis}</span>}
                  <span className="text-slate-400"> · {capitalizar(a.turno ?? "")}</span>
                  {a.motivo && <div className="text-xs text-slate-500">Motivo: {a.motivo}</div>}
                </div>
                <button onClick={() => borrarAdmin(a.id)} className="text-red-500 hover:text-red-700">✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
      </fieldset>
    </div>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">{label}</div>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(0, value - 1))} className="btn btn-secondary btn-sm">−</button>
        <span className="w-8 text-center font-semibold">{value}</span>
        <button onClick={() => onChange(value + 1)} className="btn btn-secondary btn-sm">+</button>
      </div>
    </div>
  );
}
