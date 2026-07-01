"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DIAS_NUM, TOLERANCIA_MIN } from "@/lib/constants";
import { horaCorta } from "@/lib/utils";
import type { ActividadProgramada, ActividadCompletada } from "@/lib/types";

type PacienteMin = { id: string; nombre: string };

export default function ActividadesProgramadas({
  programadas,
  completadasHoy,
  pacientes,
  esAdmin,
  miPersonalId,
  fecha,
}: {
  programadas: ActividadProgramada[];
  completadasHoy: ActividadCompletada[];
  pacientes: PacienteMin[];
  esAdmin: boolean;
  miPersonalId: string | null;
  fecha: string;
}) {
  const supabase = createClient();
  const [defs, setDefs] = useState<ActividadProgramada[]>(programadas);
  const [comp, setComp] = useState<ActividadCompletada[]>(completadasHoy);
  const [gestionar, setGestionar] = useState(false);

  // completar con motivo (para atrasadas)
  const [motivoId, setMotivoId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const nombrePac = useMemo(() => {
    const m = new Map(pacientes.map((p) => [p.id, p.nombre]));
    return (id: string | null) => (id ? m.get(id) ?? "" : "");
  }, [pacientes]);

  const dow = new Date().getDay();
  const ahoraMin = new Date().getHours() * 60 + new Date().getMinutes();

  const deHoy = defs
    .filter((a) => a.activo && a.dias_semana?.includes(dow))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const compDe = (actId: string) => comp.find((c) => c.actividad_id === actId);
  const minutosDe = (hora: string) => {
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
  };

  async function completar(act: ActividadProgramada, aTiempo: boolean, motivoRetraso?: string) {
    const { data } = await supabase
      .from("actividades_completadas")
      .upsert(
        {
          actividad_id: act.id,
          fecha,
          enfermero_id: miPersonalId,
          a_tiempo: aTiempo,
          motivo_retraso: motivoRetraso ?? null,
        },
        { onConflict: "actividad_id,fecha" },
      )
      .select()
      .single();
    if (data) {
      setComp((prev) => [...prev.filter((c) => c.actividad_id !== act.id), data]);
      setMotivoId(null);
      setMotivo("");
    }
  }

  // --- admin: crear ---
  const [nueva, setNueva] = useState({
    titulo: "",
    descripcion: "",
    paciente_id: "",
    hora: "08:00",
    dias: [1, 2, 3, 4, 5] as number[],
  });

  function toggleDia(n: number) {
    setNueva((v) => ({
      ...v,
      dias: v.dias.includes(n) ? v.dias.filter((d) => d !== n) : [...v.dias, n],
    }));
  }

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (!nueva.titulo.trim() || nueva.dias.length === 0) return;
    const { data } = await supabase
      .from("actividades_programadas")
      .insert({
        titulo: nueva.titulo.trim(),
        descripcion: nueva.descripcion || null,
        paciente_id: nueva.paciente_id || null,
        hora: nueva.hora,
        dias_semana: nueva.dias,
        creado_por: miPersonalId,
      })
      .select()
      .single();
    if (data) {
      setDefs((prev) => [...prev, data]);
      setNueva({ titulo: "", descripcion: "", paciente_id: "", hora: "08:00", dias: [1, 2, 3, 4, 5] });
    }
  }

  async function eliminarDef(id: string) {
    await supabase.from("actividades_programadas").delete().eq("id", id);
    setDefs((prev) => prev.filter((d) => d.id !== id));
  }

  return (
    <div className="space-y-5">
      {/* Actividades de hoy */}
      <div>
        <h3 className="mb-3 font-semibold text-slate-800">Actividades de hoy</h3>
        {deHoy.length === 0 ? (
          <p className="text-sm text-slate-400">No hay actividades programadas para hoy.</p>
        ) : (
          <div className="space-y-2">
            {deHoy.map((a) => {
              const hecha = compDe(a.id);
              const atrasada = !hecha && ahoraMin > minutosDe(a.hora) + TOLERANCIA_MIN;
              return (
                <div key={a.id} className={`card p-4 ${hecha ? "bg-emerald-50/40" : atrasada ? "border-amber-300 bg-amber-50/40" : ""}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-marca-700">{horaCorta(a.hora)}</span>
                        <span className="font-medium text-slate-800">{a.titulo}</span>
                        {a.paciente_id && <span className="badge bg-sky-100 text-sky-700">{nombrePac(a.paciente_id)}</span>}
                      </div>
                      {a.descripcion && <div className="text-xs text-slate-500">{a.descripcion}</div>}
                    </div>

                    {hecha ? (
                      <span className={`badge ${hecha.a_tiempo ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"}`}>
                        {hecha.a_tiempo ? "✓ Completada" : "✓ Completada (tarde)"}
                      </span>
                    ) : atrasada ? (
                      <button onClick={() => { setMotivoId(a.id); setMotivo(""); }} className="btn btn-secondary btn-sm">
                        Completar (tarde)
                      </button>
                    ) : (
                      <button onClick={() => completar(a, true)} className="btn btn-primary btn-sm">
                        Completar
                      </button>
                    )}
                  </div>

                  {!hecha && motivoId === a.id && (
                    <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-amber-200 pt-3">
                      <div className="flex-1">
                        <label className="label text-xs">¿Por qué no se hizo a tiempo? *</label>
                        <input className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del retraso" />
                      </div>
                      <button
                        onClick={() => motivo.trim() && completar(a, false, motivo.trim())}
                        className="btn btn-primary btn-sm"
                      >
                        Guardar
                      </button>
                      <button onClick={() => setMotivoId(null)} className="btn btn-ghost btn-sm">Cancelar</button>
                    </div>
                  )}

                  {hecha && !hecha.a_tiempo && hecha.motivo_retraso && (
                    <div className="mt-2 text-xs text-amber-700">Motivo del retraso: {hecha.motivo_retraso}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Gestión (admin) */}
      {esAdmin && (
        <div>
          <button onClick={() => setGestionar((v) => !v)} className="btn btn-secondary btn-sm">
            {gestionar ? "Ocultar gestión" : "⚙️ Gestionar actividades programadas"}
          </button>

          {gestionar && (
            <div className="mt-3 space-y-4">
              <form onSubmit={crear} className="card space-y-3 p-5">
                <h4 className="font-semibold text-slate-800">Nueva actividad programada</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="label">Título *</label>
                    <input className="input" value={nueva.titulo} onChange={(e) => setNueva({ ...nueva, titulo: e.target.value })} placeholder="Ej. Terapia física" />
                  </div>
                  <div>
                    <label className="label">Hora *</label>
                    <input type="time" className="input" value={nueva.hora} onChange={(e) => setNueva({ ...nueva, hora: e.target.value })} />
                  </div>
                  <div>
                    <label className="label">Paciente (opcional)</label>
                    <select className="input" value={nueva.paciente_id} onChange={(e) => setNueva({ ...nueva, paciente_id: e.target.value })}>
                      <option value="">General (todos)</option>
                      {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Descripción</label>
                    <input className="input" value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="label">Días</label>
                    <div className="flex flex-wrap gap-1">
                      {DIAS_NUM.map((d) => (
                        <button
                          key={d.n}
                          type="button"
                          onClick={() => toggleDia(d.n)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                            nueva.dias.includes(d.n) ? "border-marca-300 bg-marca-50 text-marca-700" : "border-slate-200 text-slate-500"
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Crear</button>
              </form>

              <div className="space-y-2">
                {defs.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin actividades programadas.</p>
                ) : (
                  defs.map((a) => (
                    <div key={a.id} className="card flex items-center justify-between gap-2 p-3">
                      <div>
                        <span className="font-mono text-sm text-marca-700">{horaCorta(a.hora)}</span>{" "}
                        <span className="font-medium text-slate-800">{a.titulo}</span>
                        <div className="text-xs text-slate-500">
                          {a.dias_semana.map((n) => DIAS_NUM.find((d) => d.n === n)?.label).filter(Boolean).join(", ")}
                          {a.paciente_id && ` · ${nombrePac(a.paciente_id)}`}
                        </div>
                      </div>
                      <button onClick={() => eliminarDef(a.id)} className="btn btn-danger btn-sm">Eliminar</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
