"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DIAS_SEMANA, TIEMPOS_COMIDA } from "@/lib/constants";
import type { MenuSemanal } from "@/lib/types";

export default function MenuCliente({
  inicial,
  esAdmin = true,
}: {
  inicial: MenuSemanal[];
  esAdmin?: boolean;
}) {
  const supabase = createClient();
  const [guardado, setGuardado] = useState<string | null>(null);

  const mapaInicial: Record<string, string> = {};
  inicial.forEach((m) => (mapaInicial[`${m.dia}|${m.tiempo}`] = m.descripcion));
  const [valores, setValores] = useState<Record<string, string>>(mapaInicial);

  function set(dia: string, tiempo: string, v: string) {
    setValores((prev) => ({ ...prev, [`${dia}|${tiempo}`]: v }));
  }

  async function guardar(dia: string, tiempo: string) {
    const descripcion = valores[`${dia}|${tiempo}`] ?? "";
    await supabase
      .from("menu_semanal")
      .upsert({ dia, tiempo, descripcion }, { onConflict: "dia,tiempo" });
    setGuardado(`${dia}-${tiempo}`);
    setTimeout(() => setGuardado(null), 1200);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 bg-slate-50 p-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"></th>
            {DIAS_SEMANA.map((d) => (
              <th key={d.value} className="p-2 text-center text-sm font-semibold text-slate-700">
                {d.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIEMPOS_COMIDA.map((t) => (
            <tr key={t.value} className="align-top">
              <th className="sticky left-0 bg-white p-2 text-left text-sm font-medium text-marca-700">
                {t.label}
              </th>
              {DIAS_SEMANA.map((d) => {
                const key = `${d.value}|${t.value}`;
                const marca = guardado === `${d.value}-${t.value}`;
                return (
                  <td key={key} className="p-1">
                    <textarea
                      value={valores[key] ?? ""}
                      readOnly={!esAdmin}
                      onChange={(e) => set(d.value, t.value, e.target.value)}
                      onBlur={() => esAdmin && guardar(d.value, t.value)}
                      placeholder="—"
                      className={`min-h-16 w-full resize-y rounded-lg border bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-marca-200 ${
                        !esAdmin ? "bg-slate-50" : ""
                      } ${marca ? "border-emerald-300" : "border-slate-200"}`}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {esAdmin && (
        <p className="mt-2 text-xs text-slate-400">Los cambios se guardan automáticamente al salir de cada celda.</p>
      )}
    </div>
  );
}
