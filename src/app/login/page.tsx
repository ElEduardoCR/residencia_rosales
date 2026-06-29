"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [modo, setModo] = useState<"login" | "registro">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCargando(true);
    setError(null);
    setAviso(null);

    if (modo === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Correo o contraseña incorrectos.");
        setCargando(false);
        return;
      }
      router.push("/");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setCargando(false);
        return;
      }
      if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        setAviso(
          "Cuenta creada. Revisa tu correo para confirmarla (o desactiva la confirmación por correo en Supabase).",
        );
        setCargando(false);
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-marca-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-marca-700 text-2xl">
            🌹
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Residencia Rosales</h1>
          <p className="text-sm text-slate-500">Sistema de gestión interna</p>
        </div>

        <div className="card p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            {modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </h2>

          <form onSubmit={manejarSubmit} className="space-y-4">
            <div>
              <label className="label">Correo electrónico</label>
              <input
                type="email"
                required
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@correo.com"
                autoComplete="email"
              />
            </div>
            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete={modo === "login" ? "current-password" : "new-password"}
              />
            </div>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}
            {aviso && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {aviso}
              </p>
            )}

            <button type="submit" disabled={cargando} className="btn btn-primary w-full">
              {cargando
                ? "Procesando…"
                : modo === "login"
                  ? "Entrar"
                  : "Crear cuenta"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            {modo === "login" ? (
              <button
                onClick={() => {
                  setModo("registro");
                  setError(null);
                }}
                className="font-medium text-marca-700 hover:underline"
              >
                ¿No tienes cuenta? Crear una
              </button>
            ) : (
              <button
                onClick={() => {
                  setModo("login");
                  setError(null);
                }}
                className="font-medium text-marca-700 hover:underline"
              >
                ¿Ya tienes cuenta? Iniciar sesión
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
