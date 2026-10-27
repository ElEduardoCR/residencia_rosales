"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { iniciarSesion } from "./actions";
import Icon from "@/components/Icon";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function manejarSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (cargando) return;
    const formData = new FormData(e.currentTarget);
    setCargando(true);
    setError(null);
    try {
      const resultado = await iniciarSesion(formData);
      if (!resultado.ok) {
        setError(resultado.error ?? "No pudimos iniciar sesión. Revisa tu usuario y contraseña.");
        return;
      }
      router.replace("/");
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
          <div><label className="label" htmlFor="username">Usuario</label><input id="username" name="username" type="text" required disabled={cargando} className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tu primer nombre" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="username-ayuda" /><p id="username-ayuda" className="mt-2 text-xs leading-relaxed text-slate-500">Usa tu primer nombre. Mayúsculas y minúsculas funcionan igual.</p></div>
          <div><label className="label" htmlFor="password">Contraseña</label><input id="password" name="password" type="password" required disabled={cargando} className="input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" autoComplete="current-password" /></div>
          {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-3 text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={cargando} className="btn btn-primary w-full">{cargando ? "Iniciando sesión…" : "Iniciar sesión"}{!cargando && <Icon name="arrow" width="18" height="18" />}</button>
        </form>
      </div>
      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500"><Icon name="lock" width="13" height="13" />Acceso exclusivo para personal autorizado</p>
    </div>
  </main>;
}
