"use client";

import { useState } from "react";
import Link from "next/link";
import type { Paciente } from "@/lib/types";
import { calcularEdad, iniciales } from "@/lib/utils";

export default function ListaPacientes({ pacientes }: { pacientes: Paciente[] }) {
  const [q, setQ] = useState("");
  const filtrados = pacientes.filter((p) =>
    p.nombre.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div>
      <input
        className="input mb-4 max-w-sm"
        placeholder="Buscar paciente…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-500">No se encontraron pacientes.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((p) => {
            const edad = calcularEdad(p.fecha_nacimiento);
            return (
              <Link
                key={p.id}
                href={`/pacientes/${p.id}`}
                className="card flex items-center gap-3 p-4 transition hover:border-marca-300 hover:shadow-md"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                  {p.foto_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.foto_url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center font-semibold text-slate-400">
                      {iniciales(p.nombre)}
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium text-slate-900">{p.nombre}</div>
                  <div className="text-xs text-slate-500">
                    {edad !== null ? `${edad} años` : "Edad N/D"}
                    {p.tipo_sangre && ` · ${p.tipo_sangre}`}
                  </div>
                  {p.enfermedades.length > 0 && (
                    <div className="mt-1 truncate text-xs text-marca-700">
                      {p.enfermedades.slice(0, 2).join(", ")}
                      {p.enfermedades.length > 2 && "…"}
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
