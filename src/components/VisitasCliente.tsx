"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { formatFecha, hoyISO } from "@/lib/utils";
import { PARENTESCOS } from "@/lib/constants";
import type { Salida, Visita } from "@/lib/types";
import SalidaForm from "./SalidaForm";

type PacienteMin = { id: string; nombre: string };
type SalidaConPaciente = Salida & { pacientes?: { nombre: string } | null };
type VisitaConPaciente = Visita & { pacientes?: { nombre: string } | null };

export default function VisitasCliente({
  salidas,
  visitas,
  pacientes,
  pacienteInicial = "",
}: {
  salidas: SalidaConPaciente[];
  visitas: VisitaConPaciente[];
  pacientes: PacienteMin[];
  pacienteInicial?: string;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<"salidas" | "visitas">("salidas");
  const [mostrarSalida, setMostrarSalida] = useState(!!pacienteInicial);
  const [listaVisitas, setListaVisitas] = useState<VisitaConPaciente[]>(visitas);

  // alta de visita
  const [v, setV] = useState({
    visitante_nombre: "",
    parentesco: "",
    paciente_id: "",
    fecha: hoyISO(),
    hora_entrada: "",
    motivo: "",
  });

  async function agregarVisita(e: React.FormEvent) {
    e.preventDefault();
    if (!v.visitante_nombre.trim()) return;
    const { data } = await supabase
      .from("visitas")
      .insert({
        visitante_nombre: v.visitante_nombre.trim(),
        parentesco: v.parentesco || null,
        paciente_id: v.paciente_id || null,
        fecha: v.fecha,
        hora_entrada: v.hora_entrada || null,
        motivo: v.motivo || null,
      })
      .select("*, pacientes(nombre)")
      .single();
    if (data) {
      setListaVisitas((prev) => [data, ...prev]);
      setV({ visitante_nombre: "", parentesco: "", paciente_id: "", fecha: hoyISO(), hora_entrada: "", motivo: "" });
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {(["salidas", "visitas"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              tab === t ? "border-marca-700 text-marca-700" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t === "salidas" ? "Salidas" : "Registro de visitas"}
          </button>
        ))}
      </div>

      {tab === "salidas" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button onClick={() => setMostrarSalida((x) => !x)} className="btn btn-primary">
              {mostrarSalida ? "Cerrar formulario" : "🚪 Nueva salida"}
            </button>
          </div>

          {mostrarSalida && (
            <SalidaForm
              pacientes={pacientes}
              pacienteInicial={pacienteInicial}
              onCreada={() => setMostrarSalida(false)}
            />
          )}

          {salidas.length === 0 ? (
            <p className="text-sm text-slate-400">Sin salidas registradas.</p>
          ) : (
            <div className="space-y-2">
              {salidas.map((s) => (
                <Link key={s.id} href={`/visitas/${s.id}`} className="card flex flex-wrap items-center justify-between gap-2 p-4 hover:border-marca-300">
                  <div>
                    <div className="font-medium text-slate-800">{s.pacientes?.nombre ?? "Paciente"}</div>
                    <div className="text-xs text-slate-500">
                      {formatFecha(s.fecha_salida)} → {s.fecha_regreso ? formatFecha(s.fecha_regreso) : "En curso"} · Lo lleva: {s.quien_lo_lleva}
                    </div>
                  </div>
                  <span className={`badge ${s.estado === "fuera" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                    {s.estado === "fuera" ? "Fuera" : "Regresado"}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "visitas" && (
        <div className="space-y-4">
          <form onSubmit={agregarVisita} className="card grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">Nombre del visitante *</label>
              <input className="input" required value={v.visitante_nombre} onChange={(e) => setV({ ...v, visitante_nombre: e.target.value })} />
            </div>
            <div>
              <label className="label">Parentesco</label>
              <select className="input" value={v.parentesco} onChange={(e) => setV({ ...v, parentesco: e.target.value })}>
                <option value="">—</option>
                {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Paciente que visita</label>
              <select className="input" value={v.paciente_id} onChange={(e) => setV({ ...v, paciente_id: e.target.value })}>
                <option value="">—</option>
                {pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Fecha</label>
              <input type="date" className="input" value={v.fecha} onChange={(e) => setV({ ...v, fecha: e.target.value })} />
            </div>
            <div>
              <label className="label">Hora de entrada</label>
              <input type="time" className="input" value={v.hora_entrada} onChange={(e) => setV({ ...v, hora_entrada: e.target.value })} />
            </div>
            <div>
              <label className="label">Motivo</label>
              <input className="input" value={v.motivo} onChange={(e) => setV({ ...v, motivo: e.target.value })} />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <button type="submit" className="btn btn-primary">Registrar visita</button>
            </div>
          </form>

          {listaVisitas.length === 0 ? (
            <p className="text-sm text-slate-400">Sin visitas registradas.</p>
          ) : (
            <div className="space-y-2">
              {listaVisitas.map((vi) => (
                <div key={vi.id} className="card flex flex-wrap items-center justify-between gap-2 p-4">
                  <div>
                    <span className="font-medium text-slate-800">{vi.visitante_nombre}</span>
                    {vi.parentesco && <span className="text-sm text-slate-500"> · {vi.parentesco}</span>}
                    <div className="text-xs text-slate-500">
                      {formatFecha(vi.fecha)}
                      {vi.hora_entrada && ` · ${vi.hora_entrada}`}
                      {vi.pacientes?.nombre && ` · visita a ${vi.pacientes.nombre}`}
                      {vi.motivo && ` · ${vi.motivo}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
