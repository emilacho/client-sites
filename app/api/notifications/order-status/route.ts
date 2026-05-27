import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/notifications/order-status · R96.110
 *
 * Manda WhatsApp template al cliente cuando el status del pedido cambia.
 * Estilo Domino's Pizza Tracker · cada fase del flow dispara un mensaje.
 *
 * Body · { orderCode, newStatus }
 * Gracefully degrada si Twilio no está configurado (sent:false).
 *
 * Idempotent · check naufrago_order_events para no duplicar mensaje
 * del mismo status. Insert event WHATSAPP_STATUS_NOTIFIED post-send.
 */

export const runtime = "nodejs"

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL ?? "https://naufrago.delivery"

interface Body {
  orderCode?: unknown
  newStatus?: unknown
}

function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

const STATUS_TEMPLATES: Record<string, (orderCode: string, trackingUrl: string, etaMin?: number | null) => string | null> = {
  COOKING: (code, url) =>
    `Tu pedido en Náufrago entró a la cocina 🍳\n\nCódigo · ${code}\nSeguilo en vivo · ${url}`,
  READY_FOR_PICKUP: (code, url) =>
    `Tu pedido ${code} está listo · sale en minutos 🛵\n\n${url}`,
  OUT_FOR_DELIVERY: (code, url, eta) =>
    `Tu pedido ${code} salió hacia ti 🛵${eta ? ` · llega en ~${eta} min` : ""}\n\nSeguilo · ${url}`,
  // R96.155 · 2 nuevos states derivados de geofencing rider→dropoff
  NEARING_DESTINATION: (code) =>
    `El motorizado está cerca 📍\n\nTu pedido ${code} casi llega · prepará el efectivo o el teléfono.`,
  AT_DESTINATION: (code) =>
    `🚪 El motorizado llegó · sal a recibir tu pedido ${code} 🌊`,
  DELIVERED: (code, url) =>
    `¡Llegó tu pedido ${code}! Buen provecho 🌊\n\nContanos cómo estuvo · ${url}`,
  CANCELLED: (code, url) =>
    `Tu pedido ${code} fue cancelado. Si necesitas ayuda, contestá este chat.\n\n${url}`,
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const orderCode = typeof body.orderCode === "string" ? body.orderCode : ""
  const newStatus = typeof body.newStatus === "string" ? body.newStatus : ""
  if (!orderCode || !newStatus) {
    return Response.json({ ok: false, error: "missing_fields" }, { status: 400 })
  }
  const builder = STATUS_TEMPLATES[newStatus]
  if (!builder) {
    return Response.json({ ok: true, sent: false, reason: "no_template" })
  }

  try {
    const supa = getSupabaseAdmin()

    // Fetch order para customer phone + eta + id.
    const { data: order } = await supa
      .from("naufrago_orders")
      .select("id, customer_phone, delivery_eta_minutes")
      .eq("order_code", orderCode)
      .maybeSingle()

    if (!order?.customer_phone) {
      return Response.json({ ok: true, sent: false, reason: "no_customer_phone" })
    }

    // Idempotency · check event log para mismo status.
    const { data: prevEvents } = await supa
      .from("naufrago_order_events")
      .select("id")
      .eq("order_id", order.id)
      .eq("event_type", "WHATSAPP_STATUS_NOTIFIED")
      .contains("payload", { status: newStatus })
      .limit(1)
    if (prevEvents && prevEvents.length > 0) {
      return Response.json({ ok: true, sent: false, reason: "already_notified" })
    }

    const phone = normalizeE164(order.customer_phone)
    if (!phone) {
      return Response.json({ ok: false, error: "invalid_phone" }, { status: 400 })
    }

    const trackingUrl = `${ORIGIN}/order/${orderCode}`
    const message = builder(orderCode, trackingUrl, order.delivery_eta_minutes)
    if (!message) {
      return Response.json({ ok: true, sent: false, reason: "no_message" })
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const fromWa = process.env.TWILIO_WHATSAPP_FROM
    if (!accountSid || !authToken || !fromWa) {
      return Response.json({
        ok: true,
        sent: false,
        reason: "twilio_not_configured",
      })
    }

    const params = new URLSearchParams({
      To: `whatsapp:+${phone}`,
      From: fromWa,
      Body: message,
    })
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
    )
    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return Response.json(
        {
          ok: false,
          error: "twilio_error",
          status: res.status,
          detail: detail.slice(0, 300),
        },
        { status: 502 },
      )
    }
    const data = (await res.json()) as { sid?: string }

    // Audit · register event para idempotency futuro.
    await supa.from("naufrago_order_events").insert({
      order_id: order.id,
      event_type: "WHATSAPP_STATUS_NOTIFIED",
      actor: "system",
      payload: { status: newStatus, sid: data.sid ?? null },
    })

    return Response.json({ ok: true, sent: true, sid: data.sid ?? null })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
