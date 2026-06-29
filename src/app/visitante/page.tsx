import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrarAcceso } from "./actions";

export const dynamic = "force-dynamic";

export default async function VisitantePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const admin = createAdminClient();
  const { data: pacientes } = await admin
    .from("pacientes")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-sky-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-600 text-2xl">
            👨‍👩‍👧
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Consulta de familiar</h1>
          <p className="text-sm text-slate-500">
            Revisa el estado de tu familiar en la residencia
          </p>
        </div>

        <form action={registrarAcceso} className="card space-y-4 p-6">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              Completa todos los campos.
            </p>
          )}
          <div>
            <label className="label">Tu nombre *</label>
            <input name="nombre" required className="input" placeholder="Nombre completo" />
          </div>
          <div>
            <label className="label">Tu teléfono *</label>
            <input name="telefono" required type="tel" className="input" placeholder="10 dígitos" />
          </div>
          <div>
            <label className="label">Paciente que deseas consultar *</label>
            <select name="paciente_id" required className="input" defaultValue="">
              <option value="" disabled>— Selecciona —</option>
              {(pacientes ?? []).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </div>
          <p className="text-xs text-slate-400">
            Por seguridad, tu nombre y teléfono quedan registrados al consultar.
          </p>
          <button type="submit" className="btn btn-primary w-full">Ver estado</button>
        </form>

        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-slate-500 hover:underline">
            ← Soy personal (iniciar sesión)
          </Link>
        </div>
      </div>
    </div>
  );
}
