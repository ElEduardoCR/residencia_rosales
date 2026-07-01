import webpush from "web-push";

let configurado = false;

function configurar() {
  if (configurado) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@residenciarosales.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configurado = true;
}

export interface SuscripcionPush {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PayloadPush {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Envía una notificación push. Lanza si la suscripción ya no es válida. */
export async function enviarPush(sub: SuscripcionPush, payload: PayloadPush) {
  configurar();
  return webpush.sendNotification(
    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
    JSON.stringify(payload),
  );
}
