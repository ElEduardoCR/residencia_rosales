import { createClient } from "@/lib/supabase/server";
import { hasLocalAccess } from "@/lib/local-access-server";
import type { Personal } from "./types";

export interface UsuarioActual {
  userId: string;
  email: string;
  personal: Personal | null;
  esAdmin: boolean;
  nombre: string;
}

/** Devuelve el usuario autenticado y su registro de personal (con rol). */
export async function getUsuarioActual(): Promise<UsuarioActual | null> {
  if (await hasLocalAccess()) return { userId: "local", email: "", nombre: "Administración local", esAdmin: true, personal: null };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: personal } = await supabase
    .from("personal")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!personal?.activo) return null;

  return {
    userId: user.id,
    email: personal.email ?? "",
    personal: personal ?? null,
    esAdmin: personal?.rol === "admin",
    nombre: personal?.nombre ?? user.email ?? "Usuario",
  };
}
