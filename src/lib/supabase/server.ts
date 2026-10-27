import { createServerClient } from "@supabase/ssr";
import { hasLocalAccess } from "@/lib/local-access-server";
import { createAdminClient } from "./admin";
import { cookies } from "next/headers";

/** Cliente de Supabase para Server Components / Route Handlers. */
export async function createClient() {
  if (await hasLocalAccess()) return createAdminClient();
  return createAuthClient();
}

/** Session client; always authenticates, including when used by the login action. */
export async function createAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Llamado desde un Server Component: ignorar (el middleware refresca la sesión).
          }
        },
      },
    },
  );
}
