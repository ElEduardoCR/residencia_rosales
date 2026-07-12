"use client";

import { useState } from "react";
import Link from "next/link";
import type { InventarioPaciente } from "@/lib/types";

type Item = InventarioPaciente & { pacientes?: { nombre: string } | null };

const tonoTipo: Record<string, string> = {
  pastilla: "bg-sky-100 text-sky-700",
  ml: "bg-violet-100 text-violet-700",
  otro: "bg-slate-100 text-slate-600",
};

export default function InventarioResumen({ items }: { items: Item[] }) {
  const [q, setQ] = useState("");
  const [soloBajos, setSoloBajos] = useState(false);

  const filtrados = items.filter((i) => {
    const bajo = Number(i.cantidad) <= Number(i.minimo);
    if (soloBajos && !bajo) return false;
    const txt = `${i.nombre} ${i.pacientes?.nombre ?? ""}`.toLowerCase();
    return txt.includes(q.toLowerCase());
  });

  const totalBajos = items.filter((i) => Number(i.cantidad) <= Number(i.minimo)).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input className="input max-w-xs" placeholder="Buscar medicamento o paciente…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={soloBajos} onChange={(e) => setSoloBajos(e.target.checked)} className="h-4 w-4 accent-marca-700" />
          Solo por resurtir
        </label>
        {totalBajos > 0 && <span className="badge bg-amber-100 text-amber-800">{totalBajos} por resurtir</span>}
      </div>

      {filtrados.length === 0 ? (
        <p className="text-sm text-slate-400">
          {items.length === 0 ? "Aún no hay medicamentos en inventario. Agrégalos desde la ficha de cada paciente." : "Sin resultados."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtrados.map((i) => {
            const bajo = Number(i.cantidad) <= Number(i.minimo);
            return (
              <Link
                key={i.id}
                href={`/pacientes/${i.paciente_id}`}
                className={`card flex flex-wrap items-center justify-between gap-3 p-4 hover:border-marca-300 ${bajo ? "border-amber-300 bg-amber-50/40" : ""}`}
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-slate-800">{i.nombre}</span>
                    <span className={`badge ${tonoTipo[i.tipo]}`}>{i.tipo}</span>
                    {i.dosis && <span className="badge bg-slate-100 text-slate-600">{i.dosis}</span>}
                    {bajo && <span className="badge bg-amber-200 text-amber-900">Resurtir</span>}
                  </div>
                  <div className="text-xs text-slate-500">
                    👤 {i.pacientes?.nombre ?? "Paciente"}
                    {" · "}Mín {Number(i.minimo)}{i.maximo != null && ` · Máx ${Number(i.maximo)}`} {i.unidad}
                    {i.lugar_compra && ` · 🛒 ${i.lugar_compra}`}
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-800">
                  {Number(i.cantidad)}<span className="ml-1 text-xs font-normal text-slate-400">{i.unidad}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
