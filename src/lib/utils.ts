/** Une clases condicionales (mini util tipo clsx). */
export function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/** Edad en años a partir de la fecha de nacimiento (YYYY-MM-DD). */
export function calcularEdad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const nac = new Date(fechaNacimiento);
  if (isNaN(nac.getTime())) return null;
  const hoy = new Date();
  let edad = hoy.getFullYear() - nac.getFullYear();
  const m = hoy.getMonth() - nac.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
  return edad;
}

/** Formatea una fecha YYYY-MM-DD a "DD/MM/AAAA". */
export function formatFecha(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("T")[0].split("-");
  if (!y || !m || !d) return fecha;
  return `${d}/${m}/${y}`;
}

/** Fecha de hoy en formato YYYY-MM-DD (zona local). */
export function hoyISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 10);
}

/** Días transcurridos entre dos fechas (YYYY-MM-DD). */
export function diasEntre(desde: string, hasta: string): number {
  const a = new Date(desde);
  const b = new Date(hasta);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/** Iniciales para el avatar por defecto. */
export function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Fecha (YYYY-MM-DD) de hoy en una zona horaria dada. */
export function fechaEnZona(tz: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}`;
}

/** "HH:MM:SS" o "HH:MM" -> "HH:MM". */
export function horaCorta(hora: string | null): string {
  if (!hora) return "";
  return hora.slice(0, 5);
}

/** Día de la semana (0=domingo) y minutos del día actuales en una zona horaria. */
export function ahoraEnZona(tz: string): { diaSemana: number; minutos: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let hh = parseInt(g("hour"), 10);
  if (hh === 24) hh = 0;
  return { diaSemana: wd[g("weekday")] ?? 0, minutos: hh * 60 + parseInt(g("minute"), 10) };
}
