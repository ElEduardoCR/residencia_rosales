/** Employee logins are first names, independent of letter case and accent marks. */
export function normalizarUsuario(valor: string): string {
  return valor.normalize("NFKD").replace(/\p{Diacritic}/gu, "").trim().toLocaleLowerCase("es");
}

export function usuarioDesdeNombre(nombre: string): string {
  return normalizarUsuario(nombre.trim().split(/\s+/u)[0] ?? "");
}

export function esUsuarioValido(usuario: string): boolean {
  return /^[\p{L}][\p{L}\p{M}'’-]{0,63}$/u.test(usuario);
}

export type PersonalConAcceso = { id: string; nombre: string; user_id: string | null; activo: boolean };

/** Fail closed on duplicate first names, including employees without an account yet. */
export function resolverEmpleado<T extends PersonalConAcceso>(personal: T[], usuario: string): T | null {
  const normalizado = normalizarUsuario(usuario);
  if (!esUsuarioValido(normalizado)) return null;
  const encontrados = personal.filter(p => p.activo && usuarioDesdeNombre(p.nombre) === normalizado);
  return encontrados.length === 1 && encontrados[0].user_id ? encontrados[0] : null;
}
