"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MedicamentoCatalogo } from "@/lib/types";

/** Buscador con autocompletado sobre el catálogo de medicamentos. */
export default function MedicamentoAutocomplete({
  onSelect,
  placeholder = "Buscar medicamento…",
  permitirCrear = true,
}: {
  onSelect: (m: MedicamentoCatalogo) => void;
  placeholder?: string;
  permitirCrear?: boolean;
}) {
  const supabase = createClient();
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<MedicamentoCatalogo[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [creando, setCreando] = useState(false);
  const cont = useRef<HTMLDivElement>(null);

  async function crear(tipo: MedicamentoCatalogo["tipo"]) {
    const nombre = texto.trim();
    if (!nombre) return;
    const { data } = await supabase
      .from("medicamentos_catalogo")
      .insert({ nombre, tipo })
      .select("id, nombre, principio, forma, tipo")
      .single();
    if (data) {
      onSelect(data);
      setTexto("");
      setResultados([]);
      setAbierto(false);
      setCreando(false);
    }
  }

  useEffect(() => {
    if (texto.trim().length < 2) {
      setResultados([]);
      return;
    }
    const t = setTimeout(async () => {
      setCargando(true);
      const { data } = await supabase
        .from("medicamentos_catalogo")
        .select("id, nombre, principio, forma, tipo")
        .ilike("nombre", `%${texto.trim()}%`)
        .order("nombre")
        .limit(20);
      setResultados(data ?? []);
      setCargando(false);
      setAbierto(true);
    }, 250);
    return () => clearTimeout(t);
  }, [texto, supabase]);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (cont.current && !cont.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const tonoTipo: Record<string, string> = {
    pastilla: "bg-sky-100 text-sky-700",
    ml: "bg-violet-100 text-violet-700",
    otro: "bg-slate-100 text-slate-600",
  };

  return (
    <div ref={cont} className="relative">
      <input
        className="input"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => resultados.length && setAbierto(true)}
        placeholder={placeholder}
      />
      {abierto && (texto.trim().length >= 2) && (
        <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {cargando && <div className="px-3 py-2 text-sm text-slate-400">Buscando…</div>}
          {!cargando && resultados.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">Sin resultados</div>
          )}
          {resultados.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                onSelect(m);
                setTexto("");
                setResultados([]);
                setAbierto(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-marca-50"
            >
              <span className={`badge ${tonoTipo[m.tipo]}`}>{m.tipo}</span>
              <span className="text-slate-700">{m.nombre}</span>
            </button>
          ))}

          {permitirCrear && !cargando && (
            <div className="border-t border-slate-100 p-2">
              {!creando ? (
                <button
                  type="button"
                  onClick={() => setCreando(true)}
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm text-marca-700 hover:bg-marca-50"
                >
                  ➕ Agregar «{texto.trim()}» como nuevo medicamento
                </button>
              ) : (
                <div className="px-1 py-1">
                  <div className="mb-1 text-xs text-slate-500">¿Qué tipo es «{texto.trim()}»?</div>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => crear("pastilla")} className="btn btn-secondary btn-sm">Pastilla</button>
                    <button type="button" onClick={() => crear("ml")} className="btn btn-secondary btn-sm">Líquido (ml)</button>
                    <button type="button" onClick={() => crear("otro")} className="btn btn-secondary btn-sm">Otro</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
