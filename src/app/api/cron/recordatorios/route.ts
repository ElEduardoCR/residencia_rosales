import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarPush, type SuscripcionPush } from "@/lib/push";
import { fechaHoraAgenda, tareaOcurreEnFecha, type AgendaTarea } from "@/lib/agenda";
import { indicacionSinRevisar } from "@/lib/medication-verification";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { fecha, minutos } = fechaHoraAgenda();

  const [acts, comp, subs, meds] = await Promise.all([
    admin.from("agenda_tareas").select("*", { count: "exact" }).eq("activo", true).lte("fecha_inicio", fecha).or(`fecha_fin.is.null,fecha_fin.gte.${fecha}`).limit(1000),
    admin.from("agenda_realizaciones").select("tarea_id", { count: "exact" }).eq("fecha", fecha).limit(1000),
    admin.from("push_subscriptions").select("*", { count: "exact" }).limit(1000),
    admin.from("medicamentos_paciente").select("id,activo,notas", { count: "exact" }).limit(1000),
  ]);
  if ([acts, comp, subs, meds].some(r => r.error || r.count === null || r.count > 1000)) {
    return NextResponse.json({ error: "No se pudo consultar la agenda completa" }, { status: 503 });
  }
  const completadas = new Set((comp.data ?? []).map(c => c.tarea_id));
  const revisados = new Set((meds.data ?? []).filter(m => m.activo && !indicacionSinRevisar(m.notas)).map(m => m.id));
  const porNotificar = ((acts.data ?? []) as AgendaTarea[]).filter((a) => {
    if (!tareaOcurreEnFecha(a, fecha)) return false;
    if (a.medicamento_id && !revisados.has(a.medicamento_id)) return false;
    if (completadas.has(a.id)) return false;
    const [h, m] = String(a.hora).split(":").map(Number);
    const diff = h * 60 + m - minutos; // minutos hasta la actividad
    return diff >= -1 && diff <= 11; // por vencer (~11 min) o recién vencida
  });

  const suscripciones = (subs.data ?? []) as SuscripcionPush[];
  if (porNotificar.length === 0 || suscripciones.length === 0) {
    return NextResponse.json({ enviadas: 0, porNotificar: porNotificar.length });
  }

  let enviadas = 0;
  for (const a of porNotificar) {
    const payload = {
      title: "🔔 Actividad programada",
      body: `${a.titulo} — ${String(a.hora).slice(0, 5)}`,
      url: "/agenda",
      tag: `agenda-${a.id}-${fecha}`,
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
