/** Temporary, explicit access on this computer. Never enabled in a production build. */
export function localAccessEnabled(environment = process.env.NODE_ENV, flag = process.env.NEXT_PUBLIC_LOCAL_ACCESS) {
  return environment === "development" && flag === "true";
}

export function isLoopbackRequest(headers: Pick<Headers, "get">) {
  const host = headers.get("host") ?? "";
  if (!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return false;
  if (headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = headers.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== host) return false; }
    catch { return false; }
  }
  return true;
}

const TABLES = new Set([
  "pacientes", "personal", "medicamentos_paciente", "medicamentos_catalogo",
  "registros_turno", "registros_alimentacion", "administracion_medicamentos",
  "actividades_programadas", "actividades_completadas", "salidas", "visitas", "menu_semanal",
]);
export function allowedLocalDataPath(path: string[]) {
  if (path.some(p => !p || p === "." || p === ".." || p.includes("/") || p.includes("\\"))) return false;
  if (path.length === 3 && path[0] === "rest" && path[1] === "v1") return TABLES.has(path[2]);
  return path.length >= 5 && path[0] === "storage" && path[1] === "v1" && path[2] === "object" && ["firmas", "fotos-pacientes"].includes(path[3]);
}
