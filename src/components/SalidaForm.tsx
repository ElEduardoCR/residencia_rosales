"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ITEMS_SALIDA_DEFAULT, PARENTESCOS, ZONA_HORARIA } from "@/lib/constants";
import { fechaEnZona } from "@/lib/utils";
import { subirDataURL } from "@/lib/storage";
import { CONFORMIDAD_SALIDA, DATOS_SALIDA_VACIOS, validarFechasSalida, type ArticuloSalida } from "@/lib/salidas";
import SignaturePad from "./SignaturePad";

type PacienteMin = { id: string; nombre: string; tutor_nombre?: string | null; tutor_parentesco?: string | null };
type PersonalMin = { id: string; nombre: string };

export default function SalidaForm({ pacientes, personal, pacienteInicial = "", onCreada, onCancelar }: {
  pacientes: PacienteMin[]; personal: PersonalMin[]; pacienteInicial?: string;
  onCreada?: () => void; onCancelar?: () => void;
}) {
  const router = useRouter();
  const supabase = createClient();
  const enviando = useRef(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inicial = pacientes.find((p) => p.id === pacienteInicial);
  const [pacienteId, setPacienteId] = useState(inicial?.id ?? "");
  const [familiar, setFamiliar] = useState(inicial?.tutor_nombre ?? "");
  const [parentesco, setParentesco] = useState(inicial?.tutor_parentesco ?? "");
  const [fecha, setFecha] = useState(fechaEnZona(ZONA_HORARIA));
  const [hora, setHora] = useState("");
  const [regreso, setRegreso] = useState("");
  const [datos, setDatos] = useState({ ...DATOS_SALIDA_VACIOS });
  const [inventario, setInventario] = useState<ArticuloSalida[]>(ITEMS_SALIDA_DEFAULT.map((nombre) => ({ nombre, llevado: false, notas: "" })));
  const [firma, setFirma] = useState<string | null>(null);
  const [enfermero, setEnfermero] = useState("");
  const [firmaEnfermero, setFirmaEnfermero] = useState<string | null>(null);
  const [nuevoItem, setNuevoItem] = useState("");

  function seleccionarPaciente(id: string) {
    setPacienteId(id);
    const paciente = pacientes.find((p) => p.id === id);
    setFamiliar(paciente?.tutor_nombre ?? "");
    setParentesco(paciente?.tutor_parentesco ?? "");
  }
  function agregarItem() {
    const nombre = nuevoItem.trim();
    if (!nombre) return;
    if (inventario.some((item) => item.nombre.toLocaleLowerCase() === nombre.toLocaleLowerCase())) return setError("Ese artículo ya está en el inventario.");
    setInventario((items) => [...items, { nombre, llevado: true, notas: "" }]);
    setNuevoItem("");
  }

  async function guardar(event: React.FormEvent) {
    event.preventDefault();
    if (enviando.current) return;
    if (!pacienteId || !familiar.trim()) return setError("Selecciona un residente e indica el familiar responsable.");
    if (!datos.motivo.trim() || !datos.destino.trim()) return setError("Indica el motivo y el destino de la salida.");
    const fechasError = regreso ? validarFechasSalida(fecha, regreso) : validarFechasSalida(fecha, fecha);
    if (fechasError) return setError(fechasError);
    if (!enfermero || !firma || !firmaEnfermero) return setError("Selecciona al personal que entrega y recaba ambas firmas de conformidad.");
    enviando.current = true;
    setGuardando(true);
    setError(null);
    try {
      const { data: abierta, error: consultaError } = await supabase.from("salidas").select("id").eq("paciente_id", pacienteId).eq("estado", "fuera").limit(1);
      if (consultaError) throw new Error("No se pudo comprobar si el residente tiene una salida abierta. Intenta nuevamente.");
      if (abierta?.length) throw new Error("Este residente tiene una salida abierta. Registra primero su regreso.");
      const firmaUrl = await subirDataURL(supabase, "firmas", firma);
      const firmaEnfUrl = await subirDataURL(supabase, "firmas", firmaEnfermero);
      if (!firmaUrl || !firmaEnfUrl) throw new Error("No se pudieron guardar las firmas. El registro no se guardó; intenta nuevamente.");
      const { data: creada, error: guardarError } = await supabase.from("salidas").insert({
        paciente_id: pacienteId, quien_lo_lleva: familiar.trim(), parentesco: parentesco || null,
        fecha_salida: fecha, hora_salida: hora || null, fecha_regreso_estimada: regreso || null,
        inventario, condicion_fisica_salida: [datos.estadoSalida, datos.movilidad, datos.lesionesSalida].filter(Boolean).join(" · ") || null,
        firma_salida_url: firmaUrl, enfermero_entrega_id: enfermero, firma_salida_enfermero_url: firmaEnfUrl,
        estado: "fuera", notas: JSON.stringify(datos),
      }).select("id").single();
      if (guardarError || !creada) throw new Error(guardarError?.code === "23505" ? "El residente ya tiene una salida abierta." : "No se pudo guardar la salida. Revisa tu conexión e intenta nuevamente.");
      onCreada?.();
      router.push(`/salidas/${creada.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el registro.");
    } finally { enviando.current = false; setGuardando(false); }
  }

  return (
    <form onSubmit={guardar} className="space-y-5">
      <fieldset disabled={guardando} className="space-y-5 disabled:opacity-70">
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Datos del residente y de la salida</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="label">Nombre completo del residente *</span><select className="input" value={pacienteId} onChange={(e) => seleccionarPaciente(e.target.value)} required><option value="">Selecciona un residente</option>{pacientes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
            <label><span className="label">Familiar responsable *</span><input className="input" value={familiar} onChange={(e) => setFamiliar(e.target.value)} required /></label>
            <label><span className="label">Parentesco</span><select className="input" value={parentesco} onChange={(e) => setParentesco(e.target.value)}><option value="">Selecciona</option>{parentesco && !PARENTESCOS.includes(parentesco) && <option value={parentesco}>{parentesco}</option>}{PARENTESCOS.map((p) => <option key={p}>{p}</option>)}</select></label>
            <label><span className="label">Motivo de salida *</span><input className="input" required value={datos.motivo} onChange={(e) => setDatos({ ...datos, motivo: e.target.value })} /></label>
            <label><span className="label">Destino *</span><input className="input" required value={datos.destino} onChange={(e) => setDatos({ ...datos, destino: e.target.value })} /></label>
            <label><span className="label">Fecha de salida *</span><input type="date" className="input" required value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
            <label><span className="label">Hora de salida *</span><input type="time" className="input" required value={hora} onChange={(e) => setHora(e.target.value)} /></label>
            <label><span className="label">Fecha estimada de regreso</span><input type="date" className="input" min={fecha} value={regreso} onChange={(e) => setRegreso(e.target.value)} /><span className="mt-1 block text-xs text-slate-500">Máximo 20 días. La hora real se registra al regresar.</span></label>
          </div>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Condición física y estado general al salir</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">Estado general *</span><select required className="input" value={datos.estadoSalida} onChange={(e) => setDatos({ ...datos, estadoSalida: e.target.value })}><option value="">Selecciona</option>{["Estable", "Con dolor", "Agitado(a)", "Otro"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label><span className="label">Movilidad / marcha *</span><select required className="input" value={datos.movilidad} onChange={(e) => setDatos({ ...datos, movilidad: e.target.value })}><option value="">Selecciona</option>{["Independiente", "Con apoyo", "En silla de ruedas"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="sm:col-span-2"><span className="label">Lesiones / heridas al salir y otros detalles</span><textarea className="input min-h-20" required={datos.estadoSalida === "Otro"} value={datos.lesionesSalida} onChange={(e) => setDatos({ ...datos, lesionesSalida: e.target.value })} placeholder="Describe lo observado; si elegiste Otro, especifica el estado." /></label>
          </div>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Inventario de pertenencias</h2>
          <p className="mb-4 mt-1 text-sm text-slate-500">Marca los artículos que salen y describe su cantidad o características. Se cotejarán al regreso.</p>
          <div className="space-y-2">{inventario.map((item, i) => <div key={i} className="grid gap-2 rounded-xl border border-slate-200 p-3 sm:grid-cols-2"><label className="flex min-h-11 items-center gap-3 text-sm font-medium text-slate-700"><input type="checkbox" className="h-5 w-5 accent-marca-700" checked={item.llevado} onChange={(e) => setInventario((items) => items.map((it, ix) => ix === i ? { ...it, llevado: e.target.checked } : it))} />{item.nombre}</label><input aria-label={`Descripción de ${item.nombre}`} className="input" placeholder={item.nombre.includes("dinero") ? "Cantidad en pesos y descripción" : "Descripción / observaciones"} value={item.notas ?? ""} onChange={(e) => setInventario((items) => items.map((it, ix) => ix === i ? { ...it, notas: e.target.value } : it))} /></div>)}</div>
          <div className="mt-4 flex flex-wrap gap-2"><input aria-label="Otro artículo" className="input max-w-sm" value={nuevoItem} onChange={(e) => setNuevoItem(e.target.value)} placeholder="Agregar otro artículo" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarItem(); } }} /><button type="button" className="btn btn-secondary" onClick={agregarItem}>Agregar artículo</button></div>
        </section>
        <section className="card space-y-4 p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-slate-900">Firmas de conformidad al salir</h2>
          <label className="block max-w-lg"><span className="label">Enfermera / cuidador(a) que entrega *</span><select required className="input" value={enfermero} onChange={(e) => setEnfermero(e.target.value)}><option value="">Selecciona al personal responsable</option>{personal.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
          <div className="grid gap-5 md:grid-cols-2"><SignaturePad value={firmaEnfermero} onChange={setFirmaEnfermero} label="Firma de enfermera / cuidador(a) *" /><SignaturePad value={firma} onChange={setFirma} label="Firma del familiar responsable *" /></div>
          <p className="text-xs leading-relaxed text-slate-500">{CONFORMIDAD_SALIDA}</p>
        </section>
      </fieldset>
      {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={guardando} className="btn btn-primary">{guardando ? "Guardando registro…" : "Registrar salida"}</button><button type="button" disabled={guardando} onClick={() => onCancelar ? onCancelar() : router.push("/salidas")} className="btn btn-secondary">Cancelar</button></div>
    </form>
  );
}
