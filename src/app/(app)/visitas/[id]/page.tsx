import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui";
import RegresoForm from "@/components/RegresoForm";
import { formatFecha, diasEntre } from "@/lib/utils";
import type { ItemInventarioSalida } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SalidaDetalle({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: salida }, { data: personal }] = await Promise.all([
    supabase.from("salidas").select("*, pacientes(nombre)").eq("id", id).single(),
    supabase.from("personal").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  if (!salida) notFound();

  const lista = personal ?? [];
  const nombrePersonal = (pid: string | null) =>
    pid ? (lista.find((p) => p.id === pid)?.nombre ?? "—") : "—";

  const inventario = (salida.inventario ?? []) as ItemInventarioSalida[];
  const fin = salida.fecha_regreso ?? new Date().toISOString().slice(0, 10);
  const dias = diasEntre(salida.fecha_salida, fin);

  return (
    <div>
      <PageHeader
        title="Detalle de salida"
        subtitle={salida.pacientes?.nombre ?? undefined}
        action={<Link href="/visitas" className="btn btn-secondary btn-sm">← Volver</Link>}
      />

      <div className="space-y-5">
        <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Dato label="Paciente">{salida.pacientes?.nombre}</Dato>
          <Dato label="Lo lleva">{salida.quien_lo_lleva}</Dato>
          <Dato label="Parentesco">{salida.parentesco}</Dato>
          <Dato label="Salida">{formatFecha(salida.fecha_salida)} {salida.hora_salida ?? ""}</Dato>
          <Dato label="Regreso estimado">{formatFecha(salida.fecha_regreso_estimada)}</Dato>
          <Dato label="Estado">
            <span className={`badge ${salida.estado === "fuera" ? "bg-sky-100 text-sky-700" : "bg-emerald-100 text-emerald-700"}`}>
              {salida.estado === "fuera" ? `Fuera (${dias} día/s)` : "Regresado"}
            </span>
          </Dato>
        </div>

        <div className="card p-5">
          <h3 className="mb-3 font-semibold text-slate-800">Inventario que llevó</h3>
          {inventario.length === 0 ? (
            <p className="text-sm text-slate-400">Sin artículos.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {inventario.map((it, i) => (
                <span key={i} className={`badge ${it.llevado ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-400 line-through"}`}>
                  {it.llevado ? "✓" : "✕"} {it.nombre}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <div className="card p-5">
            <h3 className="mb-2 font-semibold text-slate-800">Salida</h3>
            <p className="text-sm text-slate-600">{salida.condicion_fisica_salida || "—"}</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Firma titulo={`Enfermero: ${nombrePersonal(salida.enfermero_entrega_id)}`} url={salida.firma_salida_enfermero_url} />
              <Firma titulo="Quien se lo lleva" url={salida.firma_salida_url} />
            </div>
          </div>

          <div className="card p-5">
            <h3 className="mb-2 font-semibold text-slate-800">Regreso</h3>
            {salida.estado === "regresado" ? (
              <>
                <p className="text-sm text-slate-600">
                  {formatFecha(salida.fecha_regreso)} {salida.hora_regreso ?? ""}
                </p>
                <p className="mt-1 text-sm text-slate-600">{salida.condicion_fisica_regreso || "—"}</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Firma titulo={`Enfermero: ${nombrePersonal(salida.enfermero_recibe_id)}`} url={salida.firma_regreso_enfermero_url} />
                  <Firma titulo="Quien lo regresa" url={salida.firma_regreso_url} />
                </div>
              </>
            ) : (
              <RegresoForm salida={salida} personal={lista} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-0.5 text-sm text-slate-800">{children || "—"}</div>
    </div>
  );
}

function Firma({ titulo, url }: { titulo: string; url: string | null }) {
  return (
    <div>
      <div className="mb-1 text-xs text-slate-500">{titulo}</div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={titulo} className="h-24 w-full rounded-lg border border-slate-200 bg-white object-contain" />
      ) : (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-300">Sin firma</div>
      )}
    </div>
  );
}
