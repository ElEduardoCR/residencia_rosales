"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { fechaEnZona, diasEntre } from "@/lib/utils";
import { ZONA_HORARIA } from "@/lib/constants";
import { subirDataURL } from "@/lib/storage";
import { CONFORMIDAD_SALIDA, leerDatosSalida, validarFechasSalida, type ArticuloSalida } from "@/lib/salidas";
import type { Salida } from "@/lib/types";
import SignaturePad from "./SignaturePad";

export default function RegresoForm({ salida, personal }: { salida: Salida; personal: { id: string; nombre: string }[] }) {
  const router = useRouter();
  const supabase = createClient();
  const enviando = useRef(false);
  const [fecha, setFecha] = useState(fechaEnZona(ZONA_HORARIA));
  const [hora, setHora] = useState("");
  const [datos, setDatos] = useState(() => ({ ...leerDatosSalida(salida.notas), familiarRegreso: "" }));
  const [inventario, setInventario] = useState<ArticuloSalida[]>(() => salida.inventario.map((item) => ({ ...item, regresado: false })));
  const [firma, setFirma] = useState<string | null>(null);
  const [enfermero, setEnfermero] = useState("");
  const [firmaEnfermero, setFirmaEnfermero] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dias = diasEntre(salida.fecha_salida, fecha);

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (enviando.current) return;
    const fechasError = validarFechasSalida(salida.fecha_salida, fecha, salida.hora_salida?.slice(0, 5), hora);
    if (fechasError) return setError(fechasError);
    if (!datos.familiarRegreso.trim() || !enfermero || !firma || !firmaEnfermero) return setError("Indica quién regresa al residente, selecciona al personal y recaba ambas firmas.");
    const faltantes = inventario.filter((item) => item.llevado && !item.regresado);
    if (faltantes.length > 0 && !datos.observaciones.trim()) return setError("Hay pertenencias sin confirmar al regreso. Describe los faltantes en observaciones adicionales.");
    enviando.current = true;
    setGuardando(true);
    setError(null);
    try {
      const firmaUrl = await subirDataURL(supabase, "firmas", firma);
      const firmaEnfUrl = await subirDataURL(supabase, "firmas", firmaEnfermero);
      if (!firmaUrl || !firmaEnfUrl) throw new Error("No se pudieron guardar las firmas. El regreso no se guardó; intenta nuevamente.");
      const { data, error: guardarError } = await supabase.from("salidas").update({
        fecha_regreso: fecha, hora_regreso: hora, condicion_fisica_regreso: [datos.estadoRegreso, datos.lesionesRegreso].filter(Boolean).join(" · "),
        firma_regreso_url: firmaUrl, enfermero_recibe_id: enfermero, firma_regreso_enfermero_url: firmaEnfUrl,
        inventario, notas: JSON.stringify(datos), estado: "regresado",
      }).eq("id", salida.id).eq("estado", "fuera").select("id");
      if (guardarError) throw new Error("No se pudo guardar el regreso. Revisa tu conexión e intenta nuevamente.");
      if (!data?.length) throw new Error("Esta salida ya fue cerrada o no tienes acceso. Actualiza la página para comprobar el registro.");
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo guardar el regreso."); }
    finally { enviando.current = false; setGuardando(false); }
  }

  return <form onSubmit={guardar} className="space-y-5">
    <fieldset disabled={guardando} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label><span className="label">Fecha de regreso *</span><input type="date" className="input" min={salida.fecha_salida} required value={fecha} onChange={(e) => setFecha(e.target.value)} /><span className={`mt-1 block text-xs ${dias > 20 || dias < 0 ? "text-red-700" : "text-slate-500"}`}>{Number.isFinite(dias) ? `${dias} día(s) fuera` : "Revisa la fecha"}{dias > 20 && " · máximo 20 días"}</span></label>
        <label><span className="label">Hora de regreso *</span><input type="time" className="input" required value={hora} onChange={(e) => setHora(e.target.value)} /></label>
        <label><span className="label">Familiar responsable al regresar *</span><input className="input" required value={datos.familiarRegreso} onChange={(e) => setDatos({ ...datos, familiarRegreso: e.target.value })} /></label>
        <label><span className="label">Condición al regresar *</span><select className="input" required value={datos.estadoRegreso} onChange={(e) => setDatos({ ...datos, estadoRegreso: e.target.value })}><option value="">Selecciona</option>{["Sin cambios", "Con dolor", "Agitado(a)", "Otro"].map((estado) => <option key={estado}>{estado}</option>)}</select></label>
        <label className="sm:col-span-2"><span className="label">Lesiones / cambios al regresar</span><textarea className="input min-h-20" required={datos.estadoRegreso === "Otro"} value={datos.lesionesRegreso} onChange={(e) => setDatos({ ...datos, lesionesRegreso: e.target.value })} /></label>
      </div>
      <div>
        <h3 className="mb-2 font-semibold text-slate-800">Pertenencias que regresan</h3>
        <p className="mb-3 text-sm text-slate-500">Confirma cada artículo al recibirlo, incluidos los adicionales. Las casillas comienzan sin marcar.</p>
        <div className="space-y-2">{inventario.map((item) => <div key={item.nombre} className="rounded-xl border border-slate-200 p-3"><label className="flex min-h-11 items-center gap-3 text-sm text-slate-700"><input type="checkbox" className="h-5 w-5 accent-marca-700" checked={item.regresado ?? false} onChange={(e) => setInventario((items) => items.map((it) => it.nombre === item.nombre ? { ...it, regresado: e.target.checked } : it))} /><span><span className="font-medium">{item.nombre}</span><span className="mt-0.5 block text-xs text-slate-500">{item.llevado ? `Salió${item.notas ? `: ${item.notas}` : " con el residente"}` : "No salió con el residente"}</span></span></label><input aria-label={`Observaciones al regreso de ${item.nombre}`} className="input mt-2" value={item.notas_regreso ?? ""} onChange={(e) => setInventario((items) => items.map((it) => it.nombre === item.nombre ? { ...it, notas_regreso: e.target.value } : it))} placeholder="Observaciones al regresar" /></div>)}</div>
        {inventario.length === 0 && <p className="text-sm text-slate-500">No se registró inventario al salir. Describe los artículos recibidos en observaciones adicionales.</p>}
      </div>
      <label className="block"><span className="label">Observaciones adicionales</span><textarea className="input min-h-20" value={datos.observaciones} onChange={(e) => setDatos({ ...datos, observaciones: e.target.value })} placeholder="Describe diferencias en el inventario o cualquier incidencia." /></label>
      <label className="block max-w-lg"><span className="label">Enfermera / cuidador(a) que recibe *</span><select className="input" required value={enfermero} onChange={(e) => setEnfermero(e.target.value)}><option value="">Selecciona al personal responsable</option>{personal.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      <div className="grid gap-5 md:grid-cols-2"><SignaturePad value={firmaEnfermero} onChange={setFirmaEnfermero} label="Firma de enfermera / cuidador(a) *" /><SignaturePad value={firma} onChange={setFirma} label="Firma del familiar responsable *" /></div>
      <p className="text-xs leading-relaxed text-slate-500">{CONFORMIDAD_SALIDA}</p>
    </fieldset>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <button type="submit" disabled={guardando} className="btn btn-primary">{guardando ? "Guardando regreso…" : "Registrar regreso"}</button>
  </form>;
}
