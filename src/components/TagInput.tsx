"use client";

import { useState } from "react";

/** Entrada de etiquetas para listas (alergias, enfermedades, etc.). */
export default function TagInput({
  valores,
  onChange,
  placeholder,
  sugerencias = [],
}: {
  valores: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  sugerencias?: string[];
}) {
  const [texto, setTexto] = useState("");

  function agregar(valor: string) {
    const v = valor.trim();
    if (!v) return;
    if (!valores.some((x) => x.toLowerCase() === v.toLowerCase())) {
      onChange([...valores, v]);
    }
    setTexto("");
  }

  function quitar(i: number) {
    onChange(valores.filter((_, idx) => idx !== i));
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-300 bg-white p-2">
        {valores.map((v, i) => (
          <span key={i} className="chip">
            {v}
            <button
              type="button"
              onClick={() => quitar(i)}
              className="ml-0.5 text-slate-400 hover:text-red-600"
              aria-label={`Quitar ${v}`}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              agregar(texto);
            } else if (e.key === "Backspace" && !texto && valores.length) {
              quitar(valores.length - 1);
            }
          }}
          placeholder={valores.length === 0 ? placeholder : "Agregar…"}
          className="min-w-[120px] flex-1 bg-transparent px-1 py-1 text-sm outline-none"
        />
      </div>
      {sugerencias.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {sugerencias
            .filter((s) => !valores.some((v) => v.toLowerCase() === s.toLowerCase()))
            .slice(0, 8)
            .map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => agregar(s)}
                className="rounded-full border border-dashed border-slate-300 px-2 py-0.5 text-xs text-slate-500 hover:border-marca-400 hover:text-marca-700"
              >
                + {s}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
