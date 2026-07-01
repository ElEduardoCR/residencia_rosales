import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, type SuscripcionPush } from "@/lib/push";
import { ZONA_HORARIA } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hora actual (día de la semana 0-6, fecha y minutos del día) en la zona dada. */
function ahoraEnZona(tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const diaSemana = wd[get("weekday")] ?? 0;
  const fecha = `${get("year")}-${get("month")}-${get("day")}`;
  let hh = parseInt(get("hour"), 10);
  if (hh === 24) hh = 0;
  const minutos = hh * 60 + parseInt(get("minute"), 10);
  return { diaSemana, fecha, minutos };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { diaSemana, fecha, minutos } = ahoraEnZona(ZONA_HORARIA);

  const [{ data: acts }, { data: comp }, { data: subs }] = await Promise.all([
    admin.from("actividades_programadas").select("*").eq("activo", true),
    admin.from("actividades_completadas").select("actividad_id").eq("fecha", fecha),
    admin.from("push_subscriptions").select("*"),
  ]);

  const completadas = new Set((comp ?? []).map((c) => c.actividad_id));
  const porNotificar = (acts ?? []).filter((a) => {
    if (!a.dias_semana?.includes(diaSemana)) return false;
    if (completadas.has(a.id)) return false;
    const [h, m] = String(a.hora).split(":").map(Number);
    const diff = h * 60 + m - minutos; // minutos hasta la actividad
    return diff >= -1 && diff <= 11; // por vencer (~11 min) o recién vencida
  });

  const suscripciones = (subs ?? []) as SuscripcionPush[];
  if (porNotificar.length === 0 || suscripciones.length === 0) {
    return NextResponse.json({ enviadas: 0, porNotificar: porNotificar.length });
  }

  let enviadas = 0;
  for (const a of porNotificar) {
    const payload = {
      title: "🔔 Actividad programada",
      body: `${a.titulo} — ${String(a.hora).slice(0, 5)}`,
      url: "/actividades",
      tag: `act-${a.id}-${fecha}`,
    };
    for (const s of suscripciones) {
      try {
        await enviarPush(s, payload);
        enviadas++;
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) {
          await admin.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }
  }

  return NextResponse.json({ enviadas, porNotificar: porNotificar.length });
}
