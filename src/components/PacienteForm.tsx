"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIPOS_SANGRE, SEXOS, PARENTESCOS } from "@/lib/constants";
import type { Paciente } from "@/lib/types";
import FotoUpload from "./FotoUpload";
import TagInput from "./TagInput";

const ALERGIAS_COMUNES = ["Penicilina", "Sulfas", "AINEs", "Mariscos", "Látex", "Lácteos"];
const ENFERMEDADES_COMUNES = [
  "Hipertensión", "Diabetes tipo 2", "Demencia", "Alzheimer", "Parkinson",
  "Artritis", "EPOC", "Cardiopatía", "Osteoporosis",
];

type Datos = {
  foto_url: string | null;
  nombre: string;
  sexo: string;
  tipo_sangre: string;
  fecha_nacimiento: string;
  alergias: string[];
  enfermedades: string[];
  tutor_nombre: string;
  tutor_parentesco: string;
  tutor_contacto: string;
  peso: string;
  talla: string;
  estatura: string;
  notas: string;
};

export default function PacienteForm({ paciente }: { paciente?: Paciente }) {
  const router = useRouter();
  const supabase = createClient();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [d, setD] = useState<Datos>({
    foto_url: paciente?.foto_url ?? null,
    nombre: paciente?.nombre ?? "",
    sexo: paciente?.sexo ?? "",
    tipo_sangre: paciente?.tipo_sangre ?? "",
    fecha_nacimiento: paciente?.fecha_nacimiento ?? "",
    alergias: paciente?.alergias ?? [],
    enfermedades: paciente?.enfermedades ?? [],
    tutor_nombre: paciente?.tutor_nombre ?? "",
    tutor_parentesco: paciente?.tutor_parentesco ?? "",
    tutor_contacto: paciente?.tutor_contacto ?? "",
    peso: paciente?.peso?.toString() ?? "",
    talla: paciente?.talla?.toString() ?? "",
    estatura: paciente?.estatura?.toString() ?? "",
    notas: paciente?.notas ?? "",
  });

  function set<K extends keyof Datos>(k: K, v: Datos[K]) {
    setD((prev) => ({ ...prev, [k]: v }));
  }

  const imc = useMemo(() => {
    const p = parseFloat(d.peso);
    const e = parseFloat(d.estatura);
    if (!p || !e) return null;
    return (p / Math.pow(e / 100, 2)).toFixed(1);
  }, [d.peso, d.estatura]);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setError(null);

    const payload = {
      foto_url: d.foto_url,
      nombre: d.nombre.trim(),
      sexo: d.sexo || null,
      tipo_sangre: d.tipo_sangre || null,
      fecha_nacimiento: d.fecha_nacimiento || null,
      alergias: d.alergias,
      enfermedades: d.enfermedades,
      tutor_nombre: d.tutor_nombre || null,
      tutor_parentesco: d.tutor_parentesco || null,
      tutor_contacto: d.tutor_contacto || null,
      peso: d.peso ? parseFloat(d.peso) : null,
      talla: d.talla ? parseFloat(d.talla) : null,
      estatura: d.estatura ? parseFloat(d.estatura) : null,
      notas: d.notas || null,
    };

    if (paciente) {
      const { error } = await supabase.from("pacientes").update(payload).eq("id", paciente.id);
      if (error) return fallo(error.message);
      router.push(`/pacientes/${paciente.id}`);
    } else {
      const { data, error } = await supabase.from("pacientes").insert(payload).select("id").single();
      if (error) return fallo(error.message);
      router.push(`/pacientes/${data.id}`);
    }
    router.refresh();
  }

  function fallo(msg: string) {
    setError(msg);
    setGuardando(false);
  }

  return (
    <form onSubmit={guardar} className="space-y-6">
      <div className="card p-5">
        <FotoUpload url={d.foto_url} nombre={d.nombre} onChange={(u) => set("foto_url", u)} />
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="font-semibold text-slate-800">Datos personales</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nombre completo *</label>
            <input
              required
              className="input"
              value={d.nombre}
              onChange={(e) => set("nombre", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Sexo</label>
            <select className="input" value={d.sexo} onChange={(e) => set("sexo", e.target.value)}>
              <option value="">—</option>
              {SEXOS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Tipo de sangre</label>
            <select
              className="input"
              value={d.tipo_sangre}
              onChange={(e) => set("tipo_sangre", e.target.value)}
            >
              <option value="">—</option>
              {TIPOS_SANGRE.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Fecha de nacimiento</label>
            <input
              type="date"
              className="input"
              value={d.fecha_nacimiento}
              onChange={(e) => set("fecha_nacimiento", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="font-semibold text-slate-800">Salud</h2>
        <div>
          <label className="label">Alergias</label>
          <TagInput
            valores={d.alergias}
            onChange={(v) => set("alergias", v)}
            placeholder="Escribe y presiona Enter…"
            sugerencias={ALERGIAS_COMUNES}
          />
        </div>
        <div>
          <label className="label">Enfermedades</label>
          <TagInput
            valores={d.enfermedades}
            onChange={(v) => set("enfermedades", v)}
            placeholder="Escribe y presiona Enter…"
            sugerencias={ENFERMEDADES_COMUNES}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-4">
          <div>
            <label className="label">Peso (kg)</label>
            <input
              type="number" step="0.1" className="input"
              value={d.peso} onChange={(e) => set("peso", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Estatura (cm)</label>
            <input
              type="number" step="0.1" className="input"
              value={d.estatura} onChange={(e) => set("estatura", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Talla (cm)</label>
            <input
              type="number" step="0.1" className="input"
              value={d.talla} onChange={(e) => set("talla", e.target.value)}
            />
          </div>
          <div>
            <label className="label">IMC</label>
            <div className="input flex items-center bg-slate-50 font-semibold text-slate-700">
              {imc ?? "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <h2 className="font-semibold text-slate-800">Tutor / Adulto responsable</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Nombre del tutor</label>
            <input
              className="input"
              value={d.tutor_nombre}
              onChange={(e) => set("tutor_nombre", e.target.value)}
            />
          </div>
          <div>
            <label className="label">Parentesco</label>
            <select
              className="input"
              value={d.tutor_parentesco}
              onChange={(e) => set("tutor_parentesco", e.target.value)}
            >
              <option value="">—</option>
              {PARENTESCOS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Teléfono de contacto</label>
            <input
              type="tel"
              className="input"
              value={d.tutor_contacto}
              onChange={(e) => set("tutor_contacto", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card space-y-2 p-5">
        <label className="label">Notas</label>
        <textarea
          className="input min-h-20"
          value={d.notas}
          onChange={(e) => set("notas", e.target.value)}
        />
      </div>

      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={guardando} className="btn btn-primary">
          {guardando ? "Guardando…" : paciente ? "Guardar cambios" : "Registrar paciente"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-secondary">
          Cancelar
        </button>
      </div>
    </form>
  );
}
