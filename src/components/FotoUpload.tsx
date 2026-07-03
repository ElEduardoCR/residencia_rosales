"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { iniciales } from "@/lib/utils";

/** Subida de foto del paciente al bucket 'fotos-pacientes'. */
export default function FotoUpload({
  url,
  nombre,
  onChange,
}: {
  url: string | null;
  nombre?: string;
  onChange: (url: string | null) => void;
}) {
  const supabase = createClient();
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubiendo(true);
    setError(null);

    const ext = file.name.split(".").pop() || "jpg";
    const path = `pacientes/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("fotos-pacientes")
      .upload(path, file, { upsert: true });

    if (upErr) {
      setError("No se pudo subir la foto.");
      setSubiendo(false);
      return;
    }
    const { data } = supabase.storage.from("fotos-pacientes").getPublicUrl(path);
    onChange(data.publicUrl);
    setSubiendo(false);
  }

  return (
    <div className="flex items-center gap-4">
      <div className="h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Foto" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-slate-400">
            {nombre ? iniciales(nombre) : "👤"}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <div className="flex flex-wrap gap-2">
          <label className="btn btn-secondary btn-sm cursor-pointer">
            🖼️ Galería
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={subir}
              disabled={subiendo}
            />
          </label>
          <label className="btn btn-secondary btn-sm cursor-pointer">
            📷 Cámara
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={subir}
              disabled={subiendo}
            />
          </label>
        </div>
        {subiendo && <p className="text-xs text-slate-400">Subiendo foto…</p>}
        {url && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="block text-xs text-red-600 hover:underline"
          >
            Quitar foto
          </button>
        )}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
