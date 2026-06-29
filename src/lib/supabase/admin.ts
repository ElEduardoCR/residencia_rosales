import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con service role — SOLO para usar en el servidor.
 * Omite RLS, así que úsalo con cuidado (flujo de visitantes, creación de
 * usuarios por el admin y envío de notificaciones).
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
