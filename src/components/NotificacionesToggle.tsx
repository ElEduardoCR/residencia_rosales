"use client";

import { useEffect, useState } from "react";

type Estado = "desconocido" | "soportado" | "activadas" | "bloqueadas" | "no-soportado";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function NotificacionesToggle() {
  const [estado, setEstado] = useState<Estado>("desconocido");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setEstado("no-soportado");
      return;
    }
    if (Notification.permission === "denied") {
      setEstado("bloqueadas");
      return;
    }
    navigator.serviceWorker
      .getRegistration()
      .then(async (reg) => {
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        setEstado(sub ? "activadas" : "soportado");
      })
      .catch(() => setEstado("soportado"));
  }, []);

  async function activar() {
    setCargando(true);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permiso = await Notification.requestPermission();
      if (permiso !== "granted") {
        setEstado("bloqueadas");
        setCargando(false);
        return;
      }
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        setEstado("no-soportado");
        setCargando(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setEstado(res.ok ? "activadas" : "soportado");
    } catch (e) {
      console.error(e);
      setEstado("soportado");
    }
    setCargando(false);
  }

  if (estado === "desconocido") return null;

  if (estado === "no-soportado") {
    return (
      <div className="card p-4 text-sm text-slate-500">
        🔕 Este navegador no soporta notificaciones.
        <span className="block text-xs">En iPhone: agrega la app a la pantalla de inicio (Compartir → Agregar a inicio) y ábrela desde ahí.</span>
      </div>
    );
  }

  if (estado === "activadas") {
    return (
      <div className="card flex items-center gap-2 p-4 text-sm text-emerald-700">
        🔔 Notificaciones activadas en este dispositivo.
      </div>
    );
  }

  if (estado === "bloqueadas") {
    return (
      <div className="card p-4 text-sm text-amber-700">
        🔕 Notificaciones bloqueadas. Actívalas en los ajustes de tu navegador para este sitio.
      </div>
    );
  }

  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
      <div className="text-sm text-slate-600">
        🔔 Recibe recordatorios de las actividades programadas.
        <span className="block text-xs text-slate-400">En iPhone, primero agrega la app a la pantalla de inicio.</span>
      </div>
      <button onClick={activar} disabled={cargando} className="btn btn-primary btn-sm">
        {cargando ? "Activando…" : "Activar notificaciones"}
      </button>
    </div>
  );
}
