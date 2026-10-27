import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioActual } from "@/lib/auth";

export async function GET(_request: Request, { params }: {
  params: Promise<{ bucket: string; path: string[] }>;
}) {
  if (!await getUsuarioActual()) return new NextResponse("Acceso restringido", { status: 401 });
  const { bucket, path } = await params;
  if (!["fotos-pacientes", "firmas"].includes(bucket) || path.some(p => !p || p === "..")) {
    return new NextResponse("Archivo no disponible", { status: 404 });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).download(path.join("/"));
  if (error || !data) return new NextResponse("Archivo no disponible", { status: 404 });
  return new NextResponse(data, { headers: {
    "Content-Type": data.type || "image/png",
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  } });
}
