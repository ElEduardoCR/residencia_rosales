export type TurnoNombre = "matutino" | "vespertino" | "nocturno";
export type TipoEventoTurno = "cuidado" | "incidencia" | "glucosa" | "cistoflo" | "sueno" | "medicamento";
export const ZONA_TURNOS = "America/Mexico_City";
export const TURNOS_NOMBRES = [
  { value: "matutino", label: "Matutino" }, { value: "vespertino", label: "Vespertino" }, { value: "nocturno", label: "Nocturno" },
] as const;
export const CONTEXTOS_GLUCOSA = [
  { value: "ayuno", label: "En ayuno" }, { value: "antes_comida", label: "Antes de comer" },
  { value: "despues_comida", label: "Después de comer" }, { value: "sin_especificar", label: "Sin especificar" },
] as const;
export type ContextoGlucosa = typeof CONTEXTOS_GLUCOSA[number]["value"];
export interface HorarioTurnos { id: string; matutino: string; vespertino: string; nocturno: string; vigente_desde: string; created_at: string }
export interface VentanaTurno { id: string | null; fecha: string; turno: TurnoNombre; inicio: string; fin: string }
export interface RutinaTurno { id: string; paciente_id: string | null; turno: TurnoNombre; titulo: string; detalle: string | null; dias_semana: number[]; activo: boolean; created_at: string }
export interface PacienteTurno { id: string; nombre: string; foto_url: string | null; tiene_cistoflo: boolean; activo: boolean }
export interface MedicamentoTurno { id: string; paciente_id: string; medicamento_nombre: string; dosis: string | null; presentacion: string | null; cantidad: number; stock_verificado_at: string | null; activo: boolean; notas: string | null; turnos: TurnoNombre[] }
export interface EventoTurno {
  id: string; solicitud_id: string; jornada_id: string; paciente_id: string; tipo: TipoEventoTurno;
  titulo: string; detalle: string | null; valor: number | null; unidad: string | null; contexto: string | null;
  ocurrido_at: string; personal_id: string; registrado_at: string; corrige_id: string | null; raiz_id: string;
  anulado: boolean; motivo_correccion: string | null; rutina_id: string | null;
  agenda_tarea_id: string | null; agenda_fecha: string | null; medicamento_id: string | null;
  dosis: string | null; cantidad: number | null;
}
export interface TareaTurno {
  clave: string; paciente_id: string; titulo: string; detalle: string | null; tipo: "cuidado" | "medicamento";
  rutina_id: string | null; agenda_tarea_id: string | null; agenda_fecha: string | null; medicamento_id: string | null;
  hora: string | null; realizada: boolean; anulada?: boolean; evento_id: string | null; autor: string | null;
}
export interface TurnoData {
  usuario: { id: string; nombre: string; esAdmin: boolean; turno: TurnoNombre | "mixto" | null };
  contexto: { configurada: boolean; puedeEntrar: boolean; motivo: string | null; ventana: VentanaTurno | null; sesion: boolean };
  pacientes: PacienteTurno[]; tareas: TareaTurno[]; eventos: EventoTurno[]; medicamentos: MedicamentoTurno[];
  personal: { id: string; nombre: string }[]; ahora: string; error?: string;
}
export interface AdministracionTurnosData {
  horarios: HorarioTurnos[]; rutinas: RutinaTurno[];
  personal: {id:string;nombre:string;turno:TurnoNombre|"mixto"|null;activo:boolean}[];
  pacientes: PacienteTurno[]; medicamentos: MedicamentoTurno[]; hoy: string; error?: string;
}
export interface RegistrarEventoTurnoInput {
  solicitudId: string; jornadaId: string; pacienteId: string; tipo: TipoEventoTurno;
  titulo?: string; detalle?: string; valor?: number | null; contexto?: ContextoGlucosa;
  ocurridoAt?: string; rutinaId?: string | null; agendaTareaId?: string | null; agendaFecha?: string | null;
  medicamentoId?: string | null; cantidad?: number | null;
}
export interface CorregirEventoTurnoInput {
  eventoId: string; solicitudId: string; motivo: string; anulado?: boolean; detalle?: string;
  valor?: number | null; contexto?: ContextoGlucosa; ocurridoAt?: string; cantidad?: number | null;
}
export interface ResultadoTurno { ok?: boolean; error?: string; evento?: EventoTurno }

export function fechaTurnos(date: Date | string = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const p = new Intl.DateTimeFormat("en-CA",{timeZone:ZONA_TURNOS,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d);
  const get = (type: string) => p.find(x=>x.type===type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
export function fechaValidaTurnos(value: unknown): value is string {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const d=new Date(value+"T12:00:00Z");return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===value;
}
export function uuidTurnos(value: unknown): value is string { return typeof value==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export function minutosTurnos(value: string): number { if(!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value))return NaN;const [h,m]=value.split(":").map(Number);return h*60+m; }
export function validarHorariosTurno(v: {matutino:string;vespertino:string;nocturno:string;vigenteDesde:string}): string | null {
  const mins=[v.matutino,v.vespertino,v.nocturno].map(minutosTurnos);
  if(mins.some(Number.isNaN)||!(mins[0]<mins[1]&&mins[1]<mins[2]))return "Las horas deben seguir el orden matutino, vespertino y nocturno.";
  if(!fechaValidaTurnos(v.vigenteDesde))return "Selecciona una fecha válida de inicio.";return null;
}
export function eventosVigentesTurno(eventos: EventoTurno[]): EventoTurno[] {
  const reemplazados=new Set(eventos.map(e=>e.corrige_id).filter(Boolean));return eventos.filter(e=>!reemplazados.has(e.id)&&!e.anulado);
}
export function validarMedicionTurno(tipo: TipoEventoTurno, valor: unknown, contexto?: string): string | null {
  if(!["glucosa","cistoflo","sueno"].includes(tipo))return null;
  if(typeof valor!=="number"||!Number.isFinite(valor))return "Escribe un valor numérico.";
  if(tipo==="glucosa"&&(valor<=0||valor>2000))return "Revisa la glucosa en mg/dL.";
  if(tipo==="cistoflo"&&(valor<0||valor>10000))return "Revisa el volumen vaciado en ml.";
  if(tipo==="sueno"&&(valor<0||valor>24))return "Las horas de sueño deben estar entre 0 y 24.";
  if(tipo==="glucosa"&&!CONTEXTOS_GLUCOSA.some(c=>c.value===(contexto??"sin_especificar")))return "Selecciona el contexto de la glucosa.";
  return null;
}

/** Convert a residence wall-clock time without relying on the browser timezone. */
export function isoDesdeFechaHoraTurnos(fecha: string, hora: string): string | null {
  if (!fechaValidaTurnos(fecha) || Number.isNaN(minutosTurnos(hora))) return null;
  const wanted = `${fecha}T${hora.length === 5 ? hora + ":00" : hora}`;
  const target = Date.parse(wanted + "Z");
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_TURNOS, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  const local = (stamp: number) => {
    const parts = formatter.formatToParts(new Date(stamp));
    const get = (kind: string) => parts.find(part => part.type === kind)?.value;
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
  };
  let result = target;
  for (let step = 0; step < 3; step++) result += target - Date.parse(local(result) + "Z");
  return local(result) === wanted ? new Date(result).toISOString() : null;
}
