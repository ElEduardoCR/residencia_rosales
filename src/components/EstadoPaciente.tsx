import { calcularEdad, formatFecha, iniciales } from "@/lib/utils";
import { COMIDAS_DIA, ML_POR_VASO, TURNOS } from "@/lib/constants";
import type {
  Paciente,
  RegistroAlimentacion,
  RegistroTurno,
  AdministracionMedicamento,
  Turno,
} from "@/lib/types";

/** Tarjeta de estado del paciente (solo lectura) — usada por familiares. */
export default function EstadoPaciente({
  paciente,
  fecha,
  alimentacion,
  turnos,
  administraciones,
}: {
  paciente: Paciente;
  fecha: string;
  alimentacion: RegistroAlimentacion | null;
  turnos: RegistroTurno[];
  administraciones: AdministracionMedicamento[];
}) {
  const edad = calcularEdad(paciente.fecha_nacimiento);
  const turnoMap = new Map<Turno, RegistroTurno>();
  turnos.forEach((t) => turnoMap.set(t.turno, t));

  return (
    <div className="space-y-5">
      {/* Tarjeta del paciente */}
      <div className="card p-5">
        <div className="flex items-center gap-4">
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
          <div>
            <h2 className="text-xl font-bold text-slate-900">{paciente.nombre}</h2>
            <p className="text-sm text-slate-500">
              {edad !== null ? `${edad} años` : ""}
              {paciente.tipo_sangre && ` · 🩸 ${paciente.tipo_sangre}`}
            </p>
          </div>
        </div>
        {(paciente.alergias.length > 0 || paciente.enfermedades.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-1">
            {paciente.alergias.map((a) => (
              <span key={a} className="badge bg-red-100 text-red-700">Alergia: {a}</span>
            ))}
            {paciente.enfermedades.map((e) => (
              <span key={e} className="badge bg-amber-100 text-amber-800">{e}</span>
            ))}
          </div>
        )}
      </div>

      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Registro de hoy · {formatFecha(fecha)}
      </h3>

      {/* Alimentación */}
      <div className="card p-5">
        <h4 className="mb-3 font-semibold text-slate-800">🍽️ Alimentación e hidratación</h4>
        <div className="flex flex-wrap gap-2">
          {COMIDAS_DIA.map((c) => {
            const ok = (alimentacion?.[c.key] as boolean) ?? false;
            return (
              <span
                key={c.key}
                className={`badge ${ok ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
              >
                {ok ? "✓" : "○"} {c.label}
              </span>
            );
          })}
        </div>
        <p className="mt-3 text-sm text-slate-600">
          💧 Agua: {alimentacion?.vasos_agua ?? 0} vasos ({(alimentacion?.vasos_agua ?? 0) * ML_POR_VASO} ml)
        </p>
      </div>

      {/* Por turno */}
      <div className="card p-5">
        <h4 className="mb-3 font-semibold text-slate-800">📋 Evacuaciones y orina</h4>
        <div className="grid gap-3 sm:grid-cols-3">
          {TURNOS.map((t) => {
            const r = turnoMap.get(t.value);
            return (
              <div key={t.value} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-medium text-marca-700">{t.label}</div>
                <div className="text-slate-600">Evacuaciones: {r?.evacuaciones ?? 0}</div>
                <div className="text-slate-600">Orina: {r?.orina ?? 0}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Medicamentos administrados */}
      <div className="card p-5">
        <h4 className="mb-3 font-semibold text-slate-800">💊 Medicamentos administrados hoy</h4>
        {administraciones.length === 0 ? (
          <p className="text-sm text-slate-400">Sin registros aún.</p>
        ) : (
          <div className="space-y-1">
            {administraciones.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-700">{a.medicamento_nombre}{a.dosis && ` · ${a.dosis}`}</span>
                <span className={`badge ${a.tipo === "extra" ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700"}`}>
                  {a.tipo === "extra" ? "Extra" : "Obligatorio"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
