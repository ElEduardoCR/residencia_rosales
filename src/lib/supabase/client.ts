import { createBrowserClient } from "@supabase/ssr";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { localAccessEnabled } from "@/lib/local-access";

let localClient: SupabaseClient | undefined;
/** The browser only receives the publishable key; local requests use a guarded server proxy. */
export function createClient() {
  if (localAccessEnabled()) {
    localClient ??= createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: {
        fetch: (input, init) => {
          const source = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
          return fetch(`/api/local-data${source.pathname}${source.search}`, init);
        },
      } },
    );
    return localClient;
  }
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
