import type { EventoTurno, TurnoNombre } from "./turnos";

export type TipoHistorial = EventoTurno["tipo"] | "alimentacion" | "eliminacion" | "actividad";
export const TIPOS_HISTORIAL = [
  { value: "incidencia", label: "Incidencias" }, { value: "glucosa", label: "Glucosa" },
  { value: "cistoflo", label: "Cistoflo" }, { value: "sueno", label: "Sueño" },
  { value: "medicamento", label: "Medicamentos" }, { value: "cuidado", label: "Cuidados" },
  { value: "alimentacion", label: "Alimentación" }, { value: "eliminacion", label: "Eliminaciones" },
  { value: "actividad", label: "Actividades" },
] as const;
export interface JornadaHistorial { id: string; fecha: string; turno: TurnoNombre; inicio: string; fin: string }
export interface EntradaHistorial {
  id: string; paciente_id: string | null; tipo: TipoHistorial; titulo: string; detalle: string | null;
  fecha: string; hora: string | null; ocurrido_at: string | null; registrado_at: string | null;
  personal_id: string | null; turno: TurnoNombre | null; fuente: string;
  valor?: number | null; unidad?: string | null; contexto?: string | null; noche?: string;
  anulado?: boolean; paciente_desconocido?: boolean; evento?: EventoTurno; revisiones?: EventoTurno[];
}
export interface FiltrosHistorial { desde: string; hasta: string; paciente: string; tipo: string; turno: string; texto: string }

export function normalizarBusqueda(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}
export function fechaHistorial(iso: string): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(iso));
  const get = (t: string) => p.find(x => x.type === t)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function horaHistorial(iso: string): string {
  return new Intl.DateTimeFormat("es-MX", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));
}
export function sumarDiasHistorial(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10);
}
export function rangoMesHistorial(mes: string): { desde: string; hasta: string } {
  const [a, m] = mes.split("-").map(Number);
  return { desde: `${mes}-01`, hasta: new Date(Date.UTC(a, m, 0, 12)).toISOString().slice(0, 10) };
}

/** Keep the entire correction chain for audit, but present its terminal version. */
export function historialDeEventos(eventos: EventoTurno[], jornadas: JornadaHistorial[]): EntradaHistorial[] {
  const porJornada = new Map(jornadas.map(j => [j.id, j]));
  const reemplazados = new Set(eventos.map(e => e.corrige_id).filter(Boolean));
  const porRaiz = new Map<string, EventoTurno[]>();
  for (const e of eventos) { const lista = porRaiz.get(e.raiz_id) ?? []; lista.push(e); porRaiz.set(e.raiz_id, lista); }
  return eventos.filter(e => !reemplazados.has(e.id)).map(e => {
    const jornada = porJornada.get(e.jornada_id);
    return {
      id: `turno:${e.id}`, paciente_id: e.paciente_id, tipo: e.tipo, titulo: e.titulo,
      detalle: [e.detalle, e.dosis ? `Dosis registrada: ${e.dosis}` : null, e.cantidad != null ? `Cantidad registrada: ${e.cantidad}` : null].filter(Boolean).join(" · ") || null,
      fecha: fechaHistorial(e.ocurrido_at), hora: horaHistorial(e.ocurrido_at), ocurrido_at: e.ocurrido_at,
      registrado_at: e.registrado_at, personal_id: e.personal_id, turno: jornada?.turno ?? null,
      fuente: "Registro de turno", valor: e.valor, unidad: e.unidad, contexto: e.contexto,
      noche: e.tipo === "sueno" ? jornada?.fecha : undefined, anulado: e.anulado, evento: e,
      revisiones: (porRaiz.get(e.raiz_id) ?? []).filter(v => v.id !== e.id).sort((a, b) => a.registrado_at.localeCompare(b.registrado_at)),
    };
  });
}

export function filtrarHistorial(entradas: EntradaHistorial[], filtros: FiltrosHistorial, nombres: Record<string, string> = {}): EntradaHistorial[] {
  const palabras = normalizarBusqueda(filtros.texto).split(/\s+/).filter(Boolean);
  return entradas.filter(e => {
    if (e.fecha < filtros.desde || e.fecha > filtros.hasta || (filtros.paciente && e.paciente_id !== filtros.paciente) || (filtros.tipo && e.tipo !== filtros.tipo) || (filtros.turno && e.turno !== filtros.turno)) return false;
    const texto = normalizarBusqueda([e.titulo, e.detalle, e.contexto, e.fuente, nombres[e.paciente_id ?? ""], e.evento?.motivo_correccion,
      ...(e.revisiones ?? []).flatMap(r => [r.titulo, r.detalle, r.motivo_correccion])].filter(Boolean).join(" "));
    return palabras.every(p => texto.includes(p));
  }).sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.hora ?? "").localeCompare(a.hora ?? "") || b.id.localeCompare(a.id));
}

export interface ResumenMedicion { total: number; n: number; promedio: number | null }
export interface MetricasPaciente {
  pacienteId: string; glucosa: ResumenMedicion; glucosaContextos: { contexto: string; resumen: ResumenMedicion }[];
  cistoflo: ResumenMedicion; diasCistoflo: number; promedioCistofloDia: number | null;
  sueno: ResumenMedicion;
}
function resumir(valores: number[]): ResumenMedicion {
  const total = valores.reduce((s, v) => s + v, 0); return { total, n: valores.length, promedio: valores.length ? total / valores.length : null };
}
/** Every denominator is observed data. A real zero is an observation; absence is not. */
export function metricasHistorial(entradas: EntradaHistorial[]): MetricasPaciente[] {
  const pacientes = new Map<string, EntradaHistorial[]>();
  for (const e of entradas) {
    if (!e.paciente_id || e.anulado || !["glucosa", "cistoflo", "sueno"].includes(e.tipo) || typeof e.valor !== "number" || !Number.isFinite(e.valor)) continue;
    const lista = pacientes.get(e.paciente_id) ?? []; lista.push(e); pacientes.set(e.paciente_id, lista);
  }
  return [...pacientes].map(([pacienteId, datos]) => {
    const glucosa = datos.filter(e => e.tipo === "glucosa");
    const cistoflo = datos.filter(e => e.tipo === "cistoflo");
    // One recorded night per patient/journey; protect the summary against duplicate payloads too.
    const noches = new Map<string, EntradaHistorial>();
    for (const e of datos.filter(e => e.tipo === "sueno").sort((a, b) => (a.registrado_at ?? "").localeCompare(b.registrado_at ?? ""))) noches.set(e.noche ?? e.fecha, e);
    const porContexto = [...new Set(glucosa.map(e => e.contexto || "sin_especificar"))];
    const diasCistoflo = new Set(cistoflo.map(e => e.fecha)).size;
    const resumenCistoflo = resumir(cistoflo.map(e => e.valor!));
    return { pacienteId, glucosa: resumir(glucosa.map(e => e.valor!)),
      glucosaContextos: porContexto.map(contexto => ({ contexto, resumen: resumir(glucosa.filter(e => (e.contexto || "sin_especificar") === contexto).map(e => e.valor!)) })),
      cistoflo: resumenCistoflo, diasCistoflo, promedioCistofloDia: diasCistoflo ? resumenCistoflo.total / diasCistoflo : null,
      sueno: resumir([...noches.values()].map(e => e.valor!)),
    };
  });
}
