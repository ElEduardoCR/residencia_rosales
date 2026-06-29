"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcularEdad, formatFecha, iniciales } from "@/lib/utils";
import type { Paciente, MedicamentoPaciente, Salida } from "@/lib/types";
import RegistroDiario from "./RegistroDiario";
import MedicamentosPaciente from "./MedicamentosPaciente";

type PersonalMin = { id: string; nombre: string };
type Tab = "info" | "actividades" | "medicamentos" | "salidas";

export default function PacienteDetalle({
  paciente,
  personal,
  obligatorios,
  salidas,
  esAdmin,
}: {
  paciente: Paciente;
  personal: PersonalMin[];
  obligatorios: MedicamentoPaciente[];
  salidas: Salida[];
  esAdmin: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("info");
  const edad = calcularEdad(paciente.fecha_nacimiento);

  async function cambiarActivo() {
    await supabase.from("pacientes").update({ activo: !paciente.activo }).eq("id", paciente.id);
    router.refresh();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "info", label: "Información" },
    { id: "actividades", label: "Actividades" },
    { id: "medicamentos", label: "Medicamentos" },
    { id: "salidas", label: "Salidas" },
  ];

  return (
    <div>
      {/* Encabezado */}
      <div className="card mb-5 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-slate-100">
            {paciente.foto_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={paciente.foto_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-400">
                {iniciales(paciente.nombre)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{paciente.nombre}</h1>
              {!paciente.activo && <span className="badge bg-slate-200 text-slate-600">Inactivo</span>}
            </div>
            <p className="text-sm text-slate-500">
              {edad !== null ? `${edad} años` : "Edad N/D"}
              {paciente.tipo_sangre && ` · 🩸 ${paciente.tipo_sangre}`}
              {paciente.imc && ` · IMC ${paciente.imc}`}
            </p>
          </div>
          {esAdmin && (
            <div className="flex gap-2">
              <Link href={`/pacientes/${paciente.id}/editar`} className="btn btn-secondary btn-sm">Editar</Link>
              <button onClick={cambiarActivo} className="btn btn-secondary btn-sm">
                {paciente.activo ? "Dar de baja" : "Reactivar"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pestañas */}
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "border-marca-700 text-marca-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "info" && <InfoTab paciente={paciente} />}
      {tab === "actividades" && (
        <RegistroDiario pacienteId={paciente.id} personal={personal} obligatorios={obligatorios} />
      )}
      {tab === "medicamentos" && (
        <MedicamentosPaciente pacienteId={paciente.id} inicial={obligatorios} esAdmin={esAdmin} />
      )}
      {tab === "salidas" && <SalidasTab paciente={paciente} salidas={salidas} />}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{children || "—"}</div>
    </div>
  );
}

function InfoTab({ paciente }: { paciente: Paciente }) {
  return (
    <div className="space-y-5">
      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <Campo label="Fecha de nacimiento">{formatFecha(paciente.fecha_nacimiento)}</Campo>
        <Campo label="Sexo">{paciente.sexo}</Campo>
        <Campo label="Tipo de sangre">{paciente.tipo_sangre}</Campo>
        <Campo label="Peso">{paciente.peso ? `${paciente.peso} kg` : null}</Campo>
        <Campo label="Estatura">{paciente.estatura ? `${paciente.estatura} cm` : null}</Campo>
        <Campo label="Talla">{paciente.talla ? `${paciente.talla} cm` : null}</Campo>
        <Campo label="IMC">{paciente.imc}</Campo>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Alergias</div>
          {paciente.alergias.length ? (
            <div className="flex flex-wrap gap-1">
              {paciente.alergias.map((a) => (
                <span key={a} className="badge bg-red-100 text-red-700">{a}</span>
              ))}
            </div>
          ) : <span className="text-sm text-slate-400">Ninguna</span>}
        </div>
        <div>
          <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">Enfermedades</div>
          {paciente.enfermedades.length ? (
            <div className="flex flex-wrap gap-1">
              {paciente.enfermedades.map((e) => (
                <span key={e} className="badge bg-amber-100 text-amber-800">{e}</span>
              ))}
            </div>
          ) : <span className="text-sm text-slate-400">Ninguna</span>}
        </div>
      </div>

      <div className="card grid gap-4 p-5 sm:grid-cols-3">
        <Campo label="Tutor / responsable">{paciente.tutor_nombre}</Campo>
        <Campo label="Parentesco">{paciente.tutor_parentesco}</Campo>
        <Campo label="Teléfono">{paciente.tutor_contacto}</Campo>
      </div>

      {paciente.notas && (
        <div className="card p-5">
          <Campo label="Notas">{paciente.notas}</Campo>
        </div>
      )}
    </div>
  );
}

function SalidasTab({ paciente, salidas }: { paciente: Paciente; salidas: Salida[] }) {
  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Link href={`/visitas?paciente=${paciente.id}`} className="btn btn-primary btn-sm">
          🚪 Registrar salida
        </Link>
      </div>
      {salidas.length === 0 ? (
        <p className="text-sm text-slate-400">Sin salidas registradas.</p>
      ) : (
        <div className="space-y-2">
          {salidas.map((s) => (
            <Link key={s.id} href={`/visitas/${s.id}`} className="card flex items-center justify-between p-4 hover:border-marca-300">
              <div>
                <div className="font-medium text-slate-800">
                  {formatFecha(s.fecha_salida)} → {s.fecha_regreso ? formatFecha(s.fecha_regreso) : "En curso"}
                </div>
                <div className="text-xs text-slate-500">Lo lleva: {s.quien_lo_lleva}</div>
              </div>
              <span className={`badge ${s.estado === "fuera" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
                {s.estado === "fuera" ? "Fuera" : "Regresado"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
