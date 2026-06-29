import type { SupabaseClient } from "@supabase/supabase-js";

/** Sube una imagen en formato dataURL al bucket indicado y devuelve la URL pública. */
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
    return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  } catch {
    return null;
  }
}
