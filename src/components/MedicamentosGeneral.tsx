"use client";

import { useState, useTransition, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { contarMedicamentoTurno } from "@/app/(app)/administracion/actions";
import { existenciasSinVerificar, indicacionSinRevisar } from "@/lib/medication-verification";
import { TURNOS_NOMBRES, type MedicamentoTurno } from "@/lib/turnos";

type Medicamento = MedicamentoTurno & { minimo: number; frecuencia: string | null };
const normalizar = (v:string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
const faltaRevision = (m: Medicamento) => indicacionSinRevisar(m.notas) || !m.dosis?.trim();
const faltaConteo = (m: Medicamento) => !m.stock_verificado_at || existenciasSinVerificar(m.notas);

export default function MedicamentosGeneral({ medicamentos, pacientes, esAdmin, errorCarga }: { medicamentos:Medicamento[];pacientes:{id:string;nombre:string;activo:boolean}[];esAdmin:boolean;errorCarga?:string }) {
  const router=useRouter();
  const [busqueda,setBusqueda]=useState("");
  const [paciente,setPaciente]=useState("");
  const [filtro,setFiltro]=useState("");
  const [conteo,setConteo]=useState<Medicamento|null>(null);
  const [guardando,transicion]=useTransition();
  const [error,setError]=useState("");
  const [aviso,setAviso]=useState("");
  const nombres=new Map(pacientes.map(p=>[p.id,p.nombre]));
  const visibles=medicamentos.filter(m=>(!paciente || paciente===m.paciente_id) && (!busqueda || normalizar(`${m.medicamento_nombre} ${nombres.get(m.paciente_id)??""}`).includes(normalizar(busqueda))) && (!filtro || (filtro==="conteo"?faltaConteo(m):filtro==="revision"?faltaRevision(m):!faltaConteo(m)&&m.minimo>0&&m.cantidad<=m.minimo)));
  function contar(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!conteo || guardando || errorCarga)return;
    const f=new FormData(event.currentTarget); const raw=String(f.get("cantidad")??"").trim();const cantidad=Number(raw);const motivo=String(f.get("motivo")??"").trim();
    if(!raw || !Number.isFinite(cantidad)||cantidad<0 || !motivo){setError("Escribe la cantidad contada y el motivo.");return;}
    const m=conteo;setError("");setAviso("");
    transicion(async()=>{try{const r=await contarMedicamentoTurno({medicamentoId:m.id,cantidad,cantidadEsperada:Number(m.cantidad),motivo});if(!r.ok){setError(r.error??"No se pudo guardar el conteo.");return;}setConteo(null);setAviso("Conteo guardado con tu nombre, fecha y motivo.");router.refresh();}catch{setError("No se pudo conectar. Revisa si el conteo quedó guardado antes de intentarlo otra vez.");}});
  }
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow mb-2">Existencias de la residencia</p><h1 className="page-title">Medicamentos</h1><p className="mt-2 text-sm text-slate-600">Consulta todos los tratamientos y sus existencias en una sola lista.</p></div><Link className="btn btn-secondary" href="/turno">Registrar en mi turno</Link></header>
    <div className="grid gap-3 sm:grid-cols-3"><div className="card p-4"><strong className="text-2xl">{errorCarga?"—":medicamentos.length}</strong><p className="mt-1 text-sm text-slate-500">Medicamentos activos</p></div><div className="card p-4"><strong className="text-2xl">{errorCarga?"—":medicamentos.filter(faltaConteo).length}</strong><p className="mt-1 text-sm text-slate-500">Pendientes de conteo</p></div><div className="card p-4"><strong className="text-2xl">{errorCarga?"—":medicamentos.filter(faltaRevision).length}</strong><p className="mt-1 text-sm text-slate-500">Indicaciones por revisar</p></div></div>
    <section className="card flex flex-wrap gap-3 p-4" aria-label="Buscar medicamentos"><div className="min-w-48 flex-1"><label htmlFor="meds-buscar" className="label">Buscar</label><input id="meds-buscar" type="search" className="input" placeholder="Medicamento o paciente" value={busqueda} onChange={e=>setBusqueda(e.target.value)} /></div><div className="min-w-48 flex-1"><label htmlFor="meds-paciente" className="label">Paciente</label><select id="meds-paciente" className="input" value={paciente} onChange={e=>setPaciente(e.target.value)}><option value="">Todos los pacientes</option>{pacientes.map(p=><option key={p.id} value={p.id}>{p.nombre}{p.activo?"":" · Inactivo"}</option>)}</select></div><div className="min-w-48 flex-1"><label htmlFor="meds-filtro" className="label">Mostrar</label><select id="meds-filtro" className="input" value={filtro} onChange={e=>setFiltro(e.target.value)}><option value="">Todos</option><option value="conteo">Pendientes de conteo</option><option value="revision">Indicaciones por revisar</option><option value="bajo">Por resurtir</option></select></div></section>
    {errorCarga && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{errorCarga}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}{aviso && <p role="status" className="rounded-xl bg-marca-50 p-4 text-sm text-marca-800">{aviso}</p>}
    {esAdmin && <p className="text-sm text-slate-600">Registra un conteo físico para confirmar el saldo. Las administraciones de Mi turno descuentan la cantidad indicada por el personal; no se calcula a partir del texto de la dosis.</p>}
    {!errorCarga && <p className="text-xs text-slate-500">{visibles.length} medicamentos en esta lista</p>}
    <div className="space-y-3">{visibles.map(m=><article className="card p-5" key={m.id}><div className="flex flex-wrap items-start gap-4"><div className="min-w-52 flex-1"><p className="text-xs font-semibold text-marca-700">{nombres.get(m.paciente_id)??"Paciente registrado"}</p><h2 className="mt-1 text-lg font-semibold">{m.medicamento_nombre}</h2><p className="mt-1 text-sm text-slate-600">{m.dosis?`Dosis: ${m.dosis}`:"Sin dosis registrada"}{m.frecuencia?` · ${m.frecuencia}`:""}</p><p className="mt-1 text-xs text-slate-500">{m.turnos.length?m.turnos.map(t=>TURNOS_NOMBRES.find(x=>x.value===t)?.label).join(" · "):"Consulta la agenda para horarios específicos"}</p><div className="mt-2 flex flex-wrap gap-2">{faltaRevision(m)&&<span className="badge bg-amber-50 text-amber-800">Indicación pendiente de revisión</span>}{!faltaConteo(m)&&m.minimo>0&&m.cantidad<=m.minimo&&<span className="badge bg-amber-50 text-amber-800">Por resurtir</span>}</div></div><div className="min-w-32"><p className="text-xs text-slate-500">Existencias</p><p className="mt-1 text-xl font-semibold tabular-nums">{faltaConteo(m)?"Sin verificar":Number(m.cantidad).toLocaleString("es-MX")}</p><p className="text-xs text-slate-500">{m.presentacion??"Unidad por definir"}</p></div><div className="flex flex-wrap gap-2"><Link className="btn btn-secondary btn-sm" href={`/medicamentos/${m.id}/movimientos`}>Movimientos</Link><Link className="btn btn-secondary btn-sm" href={`/pacientes/${m.paciente_id}?tab=medicamentos`}>{esAdmin?"Revisar indicación":"Ver indicación"}</Link>{esAdmin&&<button className="btn btn-primary btn-sm" disabled={guardando||Boolean(errorCarga)} onClick={()=>{setConteo(m);setError("");setAviso("");}}>Registrar conteo</button>}</div></div>
      {conteo?.id===m.id&&<form onSubmit={contar} className="mt-5 border-t border-slate-200 pt-4"><fieldset disabled={guardando} className="grid items-end gap-3 sm:grid-cols-2"><div><label className="label" htmlFor={`conteo-${m.id}`}>Cantidad contada ({m.presentacion??"unidades"})</label><input id={`conteo-${m.id}`} name="cantidad" type="number" min="0" step="0.01" required className="input" placeholder="0 si no hay existencias" autoFocus /></div><div><label className="label" htmlFor={`conteo-motivo-${m.id}`}>Motivo del conteo</label><input id={`conteo-motivo-${m.id}`} name="motivo" required minLength={3} maxLength={1000} className="input" placeholder="Ej. Conteo físico o resurtido" /></div><p className="text-xs text-slate-500 sm:col-span-2">El saldo anterior y el nuevo quedarán registrados. Si alguien administra durante el conteo, actualiza la lista antes de guardar.</p><div className="flex flex-wrap gap-2 sm:col-span-2"><button className="btn btn-primary" type="submit">{guardando?"Guardando…":"Guardar conteo"}</button><button className="btn btn-secondary" type="button" onClick={()=>setConteo(null)}>Cancelar</button></div></fieldset></form>}
      {m.notas&&<details className="mt-4 text-sm"><summary className="min-h-10 cursor-pointer font-medium text-marca-700">Ver indicaciones y fuente</summary><p className="whitespace-pre-wrap leading-relaxed text-slate-600">{m.notas}</p></details>}
    </article>)}</div>{!errorCarga&&!visibles.length&&<p className="card p-5 text-sm text-slate-500">No hay medicamentos con estos filtros.</p>}
  </div>;
}
