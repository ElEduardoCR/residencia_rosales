import { createClient } from "@/lib/supabase/server";
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

  return {
    userId: user.id,
    email: user.email ?? "",
    personal: personal ?? null,
    esAdmin: personal?.rol === "admin",
    nombre: personal?.nombre ?? user.email ?? "Usuario",
  };
}
