"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { hoyISO, diasEntre } from "@/lib/utils";
import { subirDataURL } from "@/lib/storage";
import type { Salida } from "@/lib/types";
import SignaturePad from "./SignaturePad";

export default function RegresoForm({ salida }: { salida: Salida }) {
  const router = useRouter();
  const supabase = createClient();
  const [fecha, setFecha] = useState(hoyISO());
  const [hora, setHora] = useState("");
  const [condicion, setCondicion] = useState("");
  const [firma, setFirma] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dias = diasEntre(salida.fecha_salida, fecha);
  const excede = dias > 20;

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (excede) return setError("El regreso supera los 20 días permitidos.");
    setGuardando(true);
    setError(null);

    let firmaUrl: string | null = null;
    if (firma) firmaUrl = await subirDataURL(supabase, "firmas", firma);

    const { error } = await supabase
      .from("salidas")
      .update({
        fecha_regreso: fecha,
        hora_regreso: hora || null,
        condicion_fisica_regreso: condicion || null,
        firma_regreso_url: firmaUrl,
        estado: "regresado",
      })
      .eq("id", salida.id);

    if (error) {
      setError(error.message);
      setGuardando(false);
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Fecha de regreso</label>
          <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
          <p className={`mt-1 text-xs ${excede ? "text-red-600" : "text-slate-500"}`}>
            {dias} día(s) fuera{excede && " — supera 20 días"}
          </p>
        </div>
        <div>
          <label className="label">Hora de regreso</label>
          <input type="time" className="input" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Condición física al regresar</label>
        <textarea className="input min-h-20" value={condicion} onChange={(e) => setCondicion(e.target.value)} />
      </div>
      <SignaturePad value={firma} onChange={setFirma} label="Firma de quien entrega al paciente" />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={guardando || excede} className="btn btn-primary">
        {guardando ? "Guardando…" : "Registrar regreso"}
      </button>
    </form>
  );
}
