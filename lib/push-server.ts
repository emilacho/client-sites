/**
 * Push server helper · R96.17 · server-side push sender.
 *
 * Usado por webhook PedidosYa para enviar push notifications cuando
 * cambia el stage del pedido. Envío via `web-push` lib con VAPID
 * keys de env vars.
 *
 * Graceful degrade · si VAPID env vars no están set · no-op silencioso.
 */
import webpush, { type PushSubscription, type SendResult } from "web-push"
import { getSupabaseAdmin } from "@/lib/supabase"

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? ""
const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ?? "mailto:emilacho@hotmail.com"

let configured = false
function ensureConfigured(): boolean {
  if (configured) return true
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return false
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
  configured = true
  return true
}

export interface PushPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  image?: string
  tag?: string
  data?: Record<string, unknown>
}

/**
 * Envía push a TODAS las subscriptions activas de un order code.
 * Marca subscriptions con 410 (gone) como `unsubscribed=true` para
 * stop sending.
 */
export async function sendPushForOrder(
  orderCode: string,
  payload: PushPayload,
): Promise<{ attempted: number; sent: number; gone: number }> {
  if (!ensureConfigured()) {
    return { attempted: 0, sent: 0, gone: 0 }
  }

  const supa = getSupabaseAdmin()
  const { data: subs, error } = await supa
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("order_code", orderCode.toUpperCase())
    .eq("unsubscribed", false)

  if (error || !subs || subs.length === 0) {
    return { attempted: 0, sent: 0, gone: 0 }
  }

  let sent = 0
  let gone = 0
  const goneIds: string[] = []
  const body = JSON.stringify(payload)

  await Promise.all(
    subs.map(async (s) => {
      const subscription: PushSubscription = {
        endpoint: s.endpoint,
        keys: { p256dh: s.p256dh, auth: s.auth },
      }
      try {
        const result: SendResult = await webpush.sendNotification(
          subscription,
          body,
        )
        if (result.statusCode >= 200 && result.statusCode < 300) sent++
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          gone++
          goneIds.push(s.id)
        }
      }
    }),
  )

  if (goneIds.length > 0) {
    await supa
      .from("push_subscriptions")
      .update({ unsubscribed: true })
      .in("id", goneIds)
  }

  await supa
    .from("push_subscriptions")
    .update({ last_sent_at: new Date().toISOString() })
    .eq("order_code", orderCode.toUpperCase())
    .eq("unsubscribed", false)

  return { attempted: subs.length, sent, gone }
}

/** Mapea status PedidosYa/Naufrago a payload identity-rich Náufrago. */
export function buildStagePayload(
  status: string,
  orderCode: string,
): PushPayload | null {
  const url = `/order/${orderCode}`
  const data = { url, orderCode }
  switch (status) {
    case "PENDING":
    case "ACCEPTED":
      return {
        title: "Cocina ya tiene tu pedido",
        body: "Estamos preparando lo tuyo · te avisamos cuando salga",
        tag: `${orderCode}-stage-1`,
        data,
      }
    case "PREPARING":
    case "READY":
      return {
        title: "El cocinero está preparando tu pedido",
        body: "Fresquito · directo del fogón",
        tag: `${orderCode}-stage-2`,
        data,
      }
    case "RIDER_PICKED_UP":
    case "IN_TRANSIT":
      return {
        title: "Tu canoa zarpó",
        body: "El motorizado va camino a tu puerta",
        tag: `${orderCode}-stage-3`,
        data,
      }
    case "DELIVERED":
      return {
        title: "¡Tu tesoro llegó!",
        body: "Salud · gracias por elegir Náufrago · contanos cómo estuvo",
        tag: `${orderCode}-stage-4`,
        data,
      }
    case "CANCELLED":
      return {
        title: "Pedido cancelado",
        body: "Lo lamentamos · escribinos por WhatsApp si fue un error",
        tag: `${orderCode}-cancelled`,
        data,
      }
    default:
      return null
  }
}
