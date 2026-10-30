import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioActual } from "@/lib/auth";
import { createAuthClient } from "@/lib/supabase/server";
import { uuidTurnos } from "@/lib/turnos";
import { fechaHistorial, horaHistorial } from "@/lib/historial";

export const dynamic = "force-dynamic";
const POR_PAGINA = 50;
const TIPOS: Record<string, string> = { saldo_inicial: "Saldo anterior incorporado", conteo: "Conteo físico", administracion: "Administración", correccion: "Corrección de administración" };
const numero = (value: number) => new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 }).format(value);
const fecha = (iso: string) => new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

function ErrorCarga() {
  return <div role="alert" className="card space-y-3 p-6"><p className="text-sm text-red-700">No se pudo cargar el historial de existencias completo. Actualiza la página para volver a intentarlo.</p><Link href="/medicamentos" className="btn btn-secondary min-h-11">Volver a medicamentos</Link></div>;
}

export default async function MovimientosMedicamentoPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ pagina?: string; corte?: string }>;
}) {
  const usuario = await getUsuarioActual();
  if (!usuario?.personal?.activo || usuario.userId === "local") redirect("/login");
  const { id } = await params; const query = await searchParams;
  if (!uuidTurnos(id)) notFound();
  const pagina = typeof query.pagina === "string" && /^\d+$/.test(query.pagina) ? Math.min(1000000, Math.max(1, Number(query.pagina))) : 1;
  const ahora = new Date().toISOString();
  const corte = typeof query.corte === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(query.corte) && Number.isFinite(Date.parse(query.corte)) && query.corte <= ahora ? query.corte : ahora;
  const supabase = await createAuthClient();
  const medicamento = await supabase.from("medicamentos_paciente").select("id,paciente_id,medicamento_nombre,presentacion,cantidad,stock_verificado_at,activo").eq("id", id).maybeSingle();
  if (medicamento.error) return <ErrorCarga />;
  if (!medicamento.data) notFound();
  const med = medicamento.data;
  const [paciente, total] = await Promise.all([
    supabase.from("pacientes").select("nombre").eq("id", med.paciente_id).maybeSingle(),
    supabase.from("turnos_inventario_movimientos").select("id", { count: "exact", head: true }).eq("medicamento_id", id).lte("created_at", corte),
  ]);
  if (paciente.error || total.error || total.count == null) return <ErrorCarga />;
  const paginas = Math.max(1, Math.ceil(total.count / POR_PAGINA));
  const hrefPagina = (numeroPagina: number) => `/medicamentos/${id}/movimientos?${new URLSearchParams({ pagina: String(numeroPagina), corte })}`;
  if (pagina > paginas) redirect(hrefPagina(paginas));
  const inicio = (pagina - 1) * POR_PAGINA;
  const movimientos = await supabase.from("turnos_inventario_movimientos").select("id,tipo,delta,saldo_antes,saldo_despues,motivo,personal_id,evento_id,created_at").eq("medicamento_id", id).lte("created_at", corte).order("created_at", { ascending: false }).order("id", { ascending: false }).range(inicio, inicio + POR_PAGINA - 1);
  if (movimientos.error || movimientos.data.length !== Math.min(POR_PAGINA, total.count - inicio)) return <ErrorCarga />;
  const idsPersonal = [...new Set(movimientos.data.map(m => m.personal_id).filter((v): v is string => Boolean(v)))];
  const idsEventos = movimientos.data.map(m => m.evento_id).filter((v): v is string => Boolean(v));
  const [personal, eventos] = await Promise.all([
    idsPersonal.length ? supabase.from("personal").select("id,nombre").in("id", idsPersonal) : Promise.resolve({ data: [], error: null }),
    idsEventos.length ? supabase.from("turnos_eventos").select("id,ocurrido_at").in("id", idsEventos) : Promise.resolve({ data: [], error: null }),
  ]);
  if (personal.error || eventos.error) return <ErrorCarga />;
  const nombres = new Map((personal.data ?? []).map(p => [p.id, p.nombre]));
  const fechasEvento = new Map((eventos.data ?? []).map(e => [e.id, fechaHistorial(e.ocurrido_at)]));
  return <div className="mx-auto max-w-4xl space-y-5">
    <Link href="/medicamentos" className="btn btn-ghost min-h-11">← Medicamentos</Link>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="eyebrow">Historial de existencias</p><h1 className="page-title mt-2">{med.medicamento_nombre}</h1><p className="mt-2 text-sm text-slate-500">{paciente.data?.nombre ?? "Paciente registrado"}{!med.activo && " · Medicamento archivado"}</p></div><div className="card min-w-40 p-4"><p className="text-xs text-slate-500">Saldo actual</p><p className="mt-1 text-2xl font-semibold tabular-nums">{med.stock_verificado_at ? numero(Number(med.cantidad)) : "Sin verificar"}</p><p className="mt-1 text-xs text-slate-500">{med.presentacion ?? "Unidades del inventario"}</p></div></header>
    <p className="text-sm leading-6 text-slate-600">Cada movimiento conserva el saldo anterior, el cambio y el responsable. Los saldos anteriores incorporados corresponden a información ya existente; no representan un nuevo conteo físico.</p>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-500">{total.count ? `${inicio + 1}–${Math.min(inicio + POR_PAGINA, total.count)} de ${total.count} movimientos` : "Sin movimientos registrados"}</p><Link href={`/medicamentos/${id}/movimientos`} className="btn btn-ghost min-h-11">Actualizar historial</Link></div>
    <ol className="space-y-3">{movimientos.data.map(m => {
      const diaEvento = fechasEvento.get(m.evento_id);
      return <li key={m.id} className="card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">{TIPOS[m.tipo] ?? "Movimiento registrado"}</h2><time dateTime={m.created_at} className="mt-1 block text-xs text-slate-500">{fecha(m.created_at)} · {horaHistorial(m.created_at)} · Hora de la residencia</time></div><p className="text-sm text-slate-600">{m.tipo === "saldo_inicial" ? "Información anterior incorporada" : nombres.get(m.personal_id) ?? "Responsable no disponible"}</p></div>
        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-slate-50 p-4"><div><dt className="text-xs text-slate-500">Saldo anterior</dt><dd className="mt-1 font-semibold tabular-nums">{numero(Number(m.saldo_antes))}</dd></div><div><dt className="text-xs text-slate-500">Cambio</dt><dd className="mt-1 font-semibold tabular-nums">{Number(m.delta) > 0 ? "+" : ""}{numero(Number(m.delta))}</dd></div><div><dt className="text-xs text-slate-500">Saldo resultante</dt><dd className="mt-1 font-semibold tabular-nums">{numero(Number(m.saldo_despues))}</dd></div></dl>
        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{m.motivo}</p>
        {diaEvento && <Link className="btn btn-ghost mt-2 min-h-11" href={`/historial?${new URLSearchParams({ paciente: med.paciente_id, desde: diaEvento, hasta: diaEvento, tipo: "medicamento" })}`}>Ver registro de administración</Link>}
      </li>;
    })}</ol>
    {paginas > 1 && <nav className="flex flex-wrap items-center justify-between gap-3" aria-label="Páginas del historial de existencias"><div>{pagina > 1 && <Link href={hrefPagina(pagina - 1)} className="btn btn-secondary min-h-11">Anterior</Link>}</div><p className="text-sm text-slate-500">Página {pagina} de {paginas}</p><div>{pagina < paginas && <Link href={hrefPagina(pagina + 1)} className="btn btn-secondary min-h-11">Siguiente</Link>}</div></nav>}
  </div>;
}
