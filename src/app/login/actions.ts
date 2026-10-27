"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createAuthClient } from "@/lib/supabase/server";
import { esUsuarioValido, normalizarUsuario, resolverEmpleado } from "@/lib/usernames";

const ERROR_ACCESO = "No pudimos iniciar sesión. Revisa tu usuario y contraseña.";

export async function iniciarSesion(formData: FormData): Promise<{ ok?: boolean; error?: string }> {
  const rawUsername = formData.get("username");
  const password = formData.get("password");
  if (typeof rawUsername !== "string" || typeof password !== "string" || !password || password.length > 1024) {
    return { error: ERROR_ACCESO };
  }
  const username = normalizarUsuario(rawUsername);
  if (!esUsuarioValido(username)) return { error: ERROR_ACCESO };

  try {
    // Resolve privately; never return staff records or internal Auth identifiers to the login form.
    const admin = createAdminClient();
    const { data: personal, error, count } = await admin.from("personal")
      .select("id,nombre,user_id,activo", { count: "exact" }).eq("activo", true).order("id").limit(1000);
    if (error || !personal || count === null || count > 1000) return { error: ERROR_ACCESO };
    const empleado = resolverEmpleado(personal, username);
    if (!empleado?.user_id) return { error: ERROR_ACCESO };
    const { data: cuenta, error: cuentaError } = await admin.auth.admin.getUserById(empleado.user_id);
    if (cuentaError || !cuenta.user?.email) return { error: ERROR_ACCESO };

    // Supabase verifies the unchanged password and issues the normal cookie-based session.
    const supabase = await createAuthClient();
    const { data: sesion, error: authError } = await supabase.auth.signInWithPassword({ email: cuenta.user.email, password });
    if (authError || !sesion.user) return { error: ERROR_ACCESO };
    const { data: perfil, error: perfilError } = await supabase.from("personal")
      .select("id,activo").eq("user_id", sesion.user.id).eq("activo", true).single();
    if (perfilError || perfil?.id !== empleado.id) {
      await supabase.auth.signOut({ scope: "local" });
      return { error: ERROR_ACCESO };
    }
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { error: "No se pudo conectar. Intenta de nuevo en un momento." };
  }
}
