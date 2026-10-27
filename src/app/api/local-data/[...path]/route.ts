import { NextRequest, NextResponse } from "next/server";
import { allowedLocalDataPath, isLoopbackRequest, localAccessEnabled } from "@/lib/local-access";

async function handle(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  if (!localAccessEnabled() || !isLoopbackRequest(request.headers)) return new NextResponse("No disponible", { status: 404 });
  const { path } = await params;
  if (!allowedLocalDataPath(path)) return new NextResponse("Ruta no disponible", { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return new NextResponse("Falta configurar la conexión", { status: 503 });
  const headers = new Headers({ apikey: key, Authorization: `Bearer ${key}` });
  for (const name of ["content-type", "accept", "prefer", "range", "range-unit", "x-upsert"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  try {
    const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();
    if (body && body.byteLength > 10 * 1024 * 1024) return new NextResponse("El archivo supera 10 MB", { status: 413 });
    const target = `${url}/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
    const response = await fetch(target, { method: request.method, headers, body, cache: "no-store", redirect: "error" });
    const resultHeaders = new Headers({ "Cache-Control": "private, no-store", "Vary": "Origin" });
    for (const name of ["content-type", "content-range", "content-location"]) {
      const value = response.headers.get(name);
      if (value) resultHeaders.set(name, value);
    }
    return new NextResponse(request.method === "HEAD" || response.status === 204 ? null : response.body, { status: response.status, headers: resultHeaders });
  } catch {
    return NextResponse.json({ message: "No se pudo conectar. Tus cambios no se han confirmado." }, { status: 502 });
  }
}
export { handle as GET, handle as HEAD, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
