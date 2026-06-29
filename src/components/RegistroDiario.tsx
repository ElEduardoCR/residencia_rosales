"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { TURNOS, COMIDAS_DIA, ML_POR_VASO } from "@/lib/constants";
import { hoyISO, capitalizar } from "@/lib/utils";
import type {
  Turno,
  RegistroTurno,
  RegistroAlimentacion,
  AdministracionMedicamento,
  MedicamentoPaciente,
} from "@/lib/types";

type PersonalMin = { id: string; nombre: string };

export default function RegistroDiario({
  pacienteId,
  personal,
  obligatorios,
}: {
  pacienteId: string;
  personal: PersonalMin[];
  obligatorios: MedicamentoPaciente[];
}) {
  const supabase = createClient();
  const [fecha, setFecha] = useState(hoyISO());
  const [enfermeroDefault, setEnfermeroDefault] = useState<string>("");

  const [turnos, setTurnos] = useState<Record<Turno, RegistroTurno | null>>({
    matutino: null,
    vespertino: null,
    nocturno: null,
  });
  const [alim, setAlim] = useState<RegistroAlimentacion | null>(null);
  const [admins, setAdmins] = useState<AdministracionMedicamento[]>([]);

  const cargar = useCallback(async () => {
    const [rt, ra, am] = await Promise.all([
      supabase.from("registros_turno").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha),
      supabase.from("registros_alimentacion").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha).maybeSingle(),
      supabase.from("administracion_medicamentos").select("*").eq("paciente_id", pacienteId).eq("fecha", fecha),
    ]);
    const map: Record<Turno, RegistroTurno | null> = { matutino: null, vespertino: null, nocturno: null };
    (rt.data ?? []).forEach((r) => (map[r.turno as Turno] = r));
    setTurnos(map);
    setAlim(ra.data ?? null);
    setAdmins(am.data ?? []);
  }, [supabase, pacienteId, fecha]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function cambiarDia(delta: number) {
    const d = new Date(fecha);
    d.setDate(d.getDate() + delta);
    setFecha(d.toISOString().slice(0, 10));
  }

  // --- Evacuaciones / orina por turno ---
  async function guardarTurno(turno: Turno, campos: Partial<RegistroTurno>) {
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
    const { data } = await supabase
      .from("registros_turno")
      .upsert(payload, { onConflict: "paciente_id,fecha,turno" })
      .select()
      .single();
    if (data) setTurnos((prev) => ({ ...prev, [turno]: data }));
  }

  // --- Alimentación ---
  async function guardarAlim(campos: Partial<RegistroAlimentacion>) {
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
    const { data } = await supabase
      .from("registros_alimentacion")
      .upsert(payload, { onConflict: "paciente_id,fecha" })
      .select()
      .single();
    if (data) setAlim(data);
  }

  // --- Administración obligatoria (toggle por turno) ---
  function adminDe(nombre: string, turno: Turno, tipo: "obligatorio" | "extra") {
    return admins.find(
      (a) => a.medicamento_nombre === nombre && a.turno === turno && a.tipo === tipo,
    );
  }

  async function toggleObligatorio(med: MedicamentoPaciente, turno: Turno) {
    const existente = adminDe(med.medicamento_nombre, turno, "obligatorio");
    if (existente) {
      await supabase.from("administracion_medicamentos").delete().eq("id", existente.id);
      setAdmins((prev) => prev.filter((a) => a.id !== existente.id));
    } else {
      const { data } = await supabase
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
      if (data) setAdmins((prev) => [...prev, data]);
    }
  }

  // --- Administración extra ---
  const [extra, setExtra] = useState({ nombre: "", dosis: "", motivo: "", turno: "matutino" as Turno });
  async function agregarExtra(e: React.FormEvent) {
    e.preventDefault();
    if (!extra.nombre.trim()) return;
    const { data } = await supabase
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
    if (data) {
      setAdmins((prev) => [...prev, data]);
      setExtra({ nombre: "", dosis: "", motivo: "", turno: "matutino" });
    }
  }

  async function borrarAdmin(id: string) {
    await supabase.from("administracion_medicamentos").delete().eq("id", id);
    setAdmins((prev) => prev.filter((a) => a.id !== id));
  }

  const extras = admins.filter((a) => a.tipo === "extra");
  const vasos = alim?.vasos_agua ?? 0;

  return (
    <div className="space-y-5">
      {/* Selector de fecha y enfermero */}
      <div className="card flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Fecha</label>
          <div className="flex items-center gap-1">
            <button onClick={() => cambiarDia(-1)} className="btn btn-secondary btn-sm">←</button>
            <input type="date" className="input w-auto" value={fecha} onChange={(e) => setFecha(e.target.value)} />
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
        <h3 className="mb-1 font-semibold text-slate-800">Medicamentos obligatorios</h3>
        <p className="mb-3 text-xs text-slate-500">Marca el turno en que se administró cada medicamento.</p>
        {obligatorios.length === 0 ? (
          <p className="text-sm text-slate-400">Este paciente no tiene medicamentos obligatorios registrados.</p>
        ) : (
          <div className="space-y-2">
            {obligatorios.map((med) => {
              const turnosMed = med.turnos.length ? (med.turnos as Turno[]) : TURNOS.map((t) => t.value);
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
