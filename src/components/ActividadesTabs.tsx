"use client";

import { useState } from "react";
import type { ActividadProgramada, ActividadCompletada } from "@/lib/types";
import ActividadesProgramadas from "./ActividadesProgramadas";
import ActividadesCliente from "./ActividadesCliente";

type Min = { id: string; nombre: string };

export default function ActividadesTabs({
  pacientes,
  personal,
  programadas,
  completadasHoy,
  esAdmin,
  miPersonalId,
  fecha,
}: {
  pacientes: Min[];
  personal: Min[];
  programadas: ActividadProgramada[];
  completadasHoy: ActividadCompletada[];
  esAdmin: boolean;
  miPersonalId: string | null;
  fecha: string;
}) {
  const [tab, setTab] = useState<"programadas" | "paciente">("programadas");

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab("programadas")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "programadas" ? "border-marca-700 text-marca-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Programadas
        </button>
        <button
          onClick={() => setTab("paciente")}
          className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "paciente" ? "border-marca-700 text-marca-700" : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Registro por paciente
        </button>
      </div>

      {tab === "programadas" ? (
        <ActividadesProgramadas
          programadas={programadas}
          completadasHoy={completadasHoy}
          pacientes={pacientes}
          esAdmin={esAdmin}
          miPersonalId={miPersonalId}
          fecha={fecha}
        />
      ) : (
        <ActividadesCliente pacientes={pacientes} personal={personal} />
      )}
    </div>
  );
}
