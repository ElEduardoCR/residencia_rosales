import type { SupabaseClient } from "@supabase/supabase-js";

/** Guarda una firma privada. La URL interna exige una sesión de personal activo. */
export async function subirDataURL(
  supabase: SupabaseClient,
  bucket: string,
  dataUrl: string,
): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const path = `${crypto.randomUUID()}.png`;
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) return null;
    return `/api/archivos/${encodeURIComponent(bucket)}/${encodeURIComponent(path)}`;
  } catch {
    return null;
  }
}
