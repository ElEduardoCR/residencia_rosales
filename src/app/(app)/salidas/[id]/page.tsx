import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import RegresoForm from "@/components/RegresoForm";
import { formatFecha, diasEntre, fechaEnZona } from "@/lib/utils";
import { ZONA_HORARIA } from "@/lib/constants";
import { leerDatosSalida, CONFORMIDAD_SALIDA, type ArticuloSalida } from "@/lib/salidas";
import Imprimir from "./Imprimir";

export const dynamic = "force-dynamic";

export default async function SalidaDetalle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: salida, error }, { data: personal, error: personalError }] = await Promise.all([
    supabase.from("salidas").select("*, pacientes(nombre)").eq("id", id).maybeSingle(),
    supabase.from("personal").select("id, nombre, activo").order("nombre"),
  ]);
  if (error || personalError) return <div role="alert" className="card p-6 text-sm text-red-700">No se pudo cargar el registro. <Link className="underline" href="/salidas">Volver al historial</Link></div>;
  if (!salida) notFound();
  const lista = personal ?? [];
  const nombrePersonal = (pid: string | null) => pid ? lista.find((p) => p.id === pid)?.nombre ?? "No disponible" : "No registrado";
  const inventario = (salida.inventario ?? []) as ArticuloSalida[];
  const datos = leerDatosSalida(salida.notas);
  const dias = diasEntre(salida.fecha_salida, salida.fecha_regreso ?? fechaEnZona(ZONA_HORARIA));
  const completo = salida.estado === "regresado";

  return <div className="registro-imprimible">
    <div className="no-print"><PageHeader title="Salida y regreso" subtitle={salida.pacientes?.nombre ?? undefined} action={<div className="flex flex-wrap gap-2"><Link href="/salidas" className="btn btn-secondary">Volver al historial</Link><Imprimir /></div>} /></div>
    <div className="mb-6 hidden print:block"><p className="text-sm">Residencia Rosales · Residencia geriátrica</p><h1 className="mt-2 text-2xl font-bold">Registro de salida y regreso de residente</h1><p className="mt-2 text-xs">Folio: {salida.id}</p></div>
    <div className="space-y-5">
      <section className="card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold text-slate-900">Datos del residente</h2><span className={`badge ${completo ? "bg-emerald-100 text-emerald-800" : "bg-marca-100 text-marca-800"}`}>{completo ? "Regreso registrado" : `Fuera · ${Math.max(0, dias)} día(s)`}</span></div>
        <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Dato label="Nombre completo">{salida.pacientes?.nombre}</Dato><Dato label="Familiar responsable">{salida.quien_lo_lleva}</Dato><Dato label="Parentesco">{salida.parentesco}</Dato><Dato label="Motivo de salida">{datos.motivo}</Dato><Dato label="Destino">{datos.destino}</Dato><Dato label="Fecha y hora de salida">{formatFecha(salida.fecha_salida)} {salida.hora_salida?.slice(0, 5)}</Dato><Dato label="Regreso estimado">{formatFecha(salida.fecha_regreso_estimada)}</Dato><Dato label="Fecha y hora de regreso">{completo ? `${formatFecha(salida.fecha_regreso)} ${salida.hora_regreso?.slice(0, 5) ?? ""}` : "Pendiente"}</Dato></dl>
      </section>
      <section className="card p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold text-slate-900">Condición física y estado general al salir</h2><dl className="grid gap-4 sm:grid-cols-2"><Dato label="Estado general">{datos.estadoSalida || salida.condicion_fisica_salida}</Dato><Dato label="Movilidad / marcha">{datos.movilidad}</Dato><Dato label="Lesiones / heridas al salir">{datos.lesionesSalida}</Dato></dl></section>
      <section className="card overflow-hidden p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold text-slate-900">Inventario de pertenencias</h2><div className="overflow-x-auto"><table className="w-full min-w-120 text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th scope="col" className="pb-3 pr-3 font-medium">Artículo</th><th scope="col" className="px-3 pb-3 text-center font-medium">Sale</th><th scope="col" className="px-3 pb-3 text-center font-medium">Regresa</th><th scope="col" className="pb-3 pl-3 font-medium">Descripción / observaciones</th></tr></thead><tbody>{inventario.map((item, i) => <tr key={i} className="border-b border-slate-100 last:border-0"><th scope="row" className="py-3 pr-3 font-medium text-slate-800">{item.nombre}</th><td className="px-3 py-3 text-center text-slate-600">{item.llevado ? "Sí" : "No"}</td><td className="px-3 py-3 text-center text-slate-600">{!completo ? "Pendiente" : item.regresado === undefined ? "No registrado" : item.regresado ? "Sí" : "No"}</td><td className="py-3 pl-3 text-slate-600"><p>{item.notas || "—"}</p>{item.notas_regreso && <p className="mt-1">Al regresar: {item.notas_regreso}</p>}</td></tr>)}</tbody></table></div>{!inventario.length && <p className="text-sm text-slate-500">No se registraron pertenencias.</p>}</section>
      <section className="card p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold text-slate-900">Firmas de conformidad al salir</h2><div className="grid gap-5 sm:grid-cols-2"><Firma titulo="Enfermera / cuidador(a)" nombre={nombrePersonal(salida.enfermero_entrega_id)} url={salida.firma_salida_enfermero_url} /><Firma titulo="Familiar responsable" nombre={salida.quien_lo_lleva} url={salida.firma_salida_url} /></div></section>
      {completo ? <section className="card p-5 sm:p-6"><h2 className="mb-4 text-lg font-semibold text-slate-900">Condición al regresar</h2><dl className="grid gap-4 sm:grid-cols-2"><Dato label="Estado general">{datos.estadoRegreso || salida.condicion_fisica_regreso}</Dato><Dato label="Lesiones / cambios al regresar">{datos.lesionesRegreso}</Dato><Dato label="Observaciones adicionales">{datos.observaciones}</Dato></dl><h3 className="mb-4 mt-6 font-semibold text-slate-900">Firmas de conformidad al regresar</h3><div className="grid gap-5 sm:grid-cols-2"><Firma titulo="Enfermera / cuidador(a)" nombre={nombrePersonal(salida.enfermero_recibe_id)} url={salida.firma_regreso_enfermero_url} /><Firma titulo="Familiar responsable" nombre={datos.familiarRegreso || "No registrado"} url={salida.firma_regreso_url} /></div></section> : <><section className="card p-5 sm:p-6 no-print"><h2 className="mb-4 text-lg font-semibold text-slate-900">Registrar regreso</h2><RegresoForm salida={salida} personal={lista.filter((p) => p.activo)} /></section><p className="hidden print:block">Condición al regresar y firmas de recepción: pendientes de registrar.</p></>}
      <p className="text-xs leading-relaxed text-slate-500">{CONFORMIDAD_SALIDA}</p>
    </div>
  </div>;
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{children || "No registrado"}</dd></div>;
}
function Firma({ titulo, nombre, url }: { titulo: string; nombre: string; url: string | null }) {
  return <div><p className="text-xs text-slate-500">{titulo}</p><p className="mb-2 mt-1 text-sm font-medium text-slate-800">{nombre}</p>{url ?
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`Firma de ${nombre}`} style={{ backgroundColor: "#fff" }} className="h-28 w-full rounded-xl border border-slate-200 bg-white object-contain" /> : <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500">Sin firma registrada</div>}</div>;
}
