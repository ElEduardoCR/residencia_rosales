"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError("No pudimos iniciar sesión. Revisa tu correo y contraseña."); return; }
      const { data: personal, error: errorPersonal } = await supabase.from("personal").select("id").eq("user_id", data.user.id).eq("activo", true).maybeSingle();
      if (errorPersonal || !personal) {
        await supabase.auth.signOut();
        setError(errorPersonal ? "No pudimos verificar tu acceso. Intenta de nuevo en un momento." : "Tu cuenta aún no está vinculada al personal activo. Contacta a administración.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo en un momento.");
    } finally {
      setCargando(false);
    }
  }

  return <main className="flex min-h-dvh items-center justify-center px-5 py-12">
    <div className="w-full max-w-[420px]">
      <div className="mb-9 text-center">
        <div className="brand-mark mx-auto mb-5 !h-16 !w-16 !rounded-[22px]"><Icon name="heart" width="32" height="32" /></div>
        <p className="eyebrow mb-2">RESIDENCIA ROSALES</p>
        <h1 className="page-title">El cuidado empieza aquí.</h1>
        <p className="mt-3 text-sm text-slate-500">Un espacio para acompañar cada día.</p>
      </div>
      <div className="card px-6 py-7 sm:px-8 sm:py-8">
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Bienvenido de nuevo</h2>
        <p className="mb-6 mt-1.5 text-sm text-slate-500">Ingresa con tu cuenta de personal.</p>
        <form onSubmit={manejarSubmit} className="space-y-5" aria-busy={cargando}>
          <div><label className="label" htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@correo.com" autoComplete="email" autoCapitalize="none" /></div>
          <div><label className="label" htmlFor="password">Contraseña</label><input id="password" name="password" type="password" required className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" autoComplete="current-password" /></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={cargando} className="btn btn-primary w-full">{cargando ? "Iniciando sesión…" : "Iniciar sesión"}{!cargando && <Icon name="arrow" width="18" height="18" />}</button>
        </form>
      </div>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500"><Icon name="lock" width="13" height="13" />Acceso exclusivo para personal autorizado</p>
    </div>
  </main>;
}
