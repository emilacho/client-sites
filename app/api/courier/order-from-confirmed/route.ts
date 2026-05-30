import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import {
  getDeliveryQuote,
  createOrder as createPedidosYaOrder,
} from "@/lib/courier/pedidosya-client"

/**
 * POST /api/courier/order-from-confirmed · R97.4 · Fase 3
 *
 * Cierra el ciclo del pedido voz IA + WhatsApp · toma una orden que ya
 * tiene ubicación + detalle recibidos vía WhatsApp (status CONFIRMED ·
 * R96.156 incoming/route.ts dispatcha esto post-detail) · cotiza con
 * PedidosYa Courier + dispatcha el motorizado · transiciona a ACCEPTED.
 *
 * Body · { orderCode }
 * Response · { ok, status, deliveryProviderOrderId?, etaMinutes?,
 *              deliveryFeeUsd?, trackingUrl? }
 *
 * Idempotente · si la orden ya está en ACCEPTED o más adelante en el
 * lifecycle · devolvemos el estado actual sin re-dispatch. Si PedidosYa
 * creds no están seteadas · marcamos la orden CONFIRMED + log + WhatsApp
 * fallback al cliente (staff hace dispatch manual via PedidosYa app).
 */

export const runtime = "nodejs"

interface Body {
  orderCode?: unknown
}

const ORIGIN =
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.NEXT_PUBLIC_BASE_URL ??
  "https://naufrago.delivery"

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const orderCode = typeof body.orderCode === "string" ? body.orderCode : ""
  if (!orderCode) {
    return Response.json(
      { ok: false, error: "missing_orderCode" },
      { status: 400 },
    )
  }

  const supa = getSupabaseAdmin()

  const { data: order, error: fetchErr } = await supa
    .from("orders")
    .select(
      "id, status, customer_name, customer_phone, customer_email, dropoff_lat, dropoff_lng, dropoff_detail, cart_lines, subtotal_usd, total_usd, delivery_provider, delivery_provider_order_id, delivery_provider_tracking_url, delivery_eta_minutes, delivery_fee_usd, delivery_quote_token",
    )
    .eq("order_code", orderCode)
    .maybeSingle()

  if (fetchErr) {
    return Response.json(
      { ok: false, error: "fetch_failed", detail: fetchErr.message },
      { status: 500 },
    )
  }
  if (!order) {
    return Response.json(
      { ok: false, error: "order_not_found", orderCode },
      { status: 404 },
    )
  }

  // ─── Idempotency · si ya fue dispatched · devolver estado actual
  const downstreamStates = new Set([
    "ACCEPTED",
    "PREPARING",
    "READY",
    "RIDER_PICKED_UP",
    "IN_TRANSIT",
    "DELIVERED",
    "CANCELLED",
  ])
  if (downstreamStates.has(order.status)) {
    return Response.json({
      ok: true,
      status: order.status,
      deliveryProviderOrderId: order.delivery_provider_order_id,
      etaMinutes: order.delivery_eta_minutes,
      deliveryFeeUsd: order.delivery_fee_usd,
      trackingUrl: order.delivery_provider_tracking_url,
      reason: "already_dispatched",
    })
  }

  // ─── Estado requerido · CONFIRMED (post-detail) o PENDING_LOCATION_DETAIL
  //     (defensivo · si webhook llegó a este endpoint pre-transition)
  if (
    order.status !== "CONFIRMED" &&
    order.status !== "PENDING_LOCATION_DETAIL"
  ) {
    return Response.json({
      ok: false,
      status: order.status,
      error: "wrong_status",
      message: `Order ${orderCode} en status ${order.status} · esperaba CONFIRMED.`,
    })
  }

  // ─── Validación ubicación
  if (!order.dropoff_lat || !order.dropoff_lng) {
    return Response.json(
      {
        ok: false,
        error: "missing_dropoff_coordinates",
        message: "Orden no tiene lat/lng · WhatsApp location share pendiente.",
      },
      { status: 400 },
    )
  }

  // ─── Cotizar PedidosYa Courier
  const cartLines = Array.isArray(order.cart_lines) ? order.cart_lines : []
  const itemCount = cartLines.reduce(
    (s: number, l: { qty?: number }) => s + (l.qty ?? 1),
    0,
  )

  let quote: Awaited<ReturnType<typeof getDeliveryQuote>>
  try {
    quote = await getDeliveryQuote({
      dropoff: {
        street: order.dropoff_detail ?? "Olón · ubicación compartida vía WhatsApp",
        detail: order.dropoff_detail ?? undefined,
        countryCode: "EC",
        latitude: Number(order.dropoff_lat),
        longitude: Number(order.dropoff_lng),
      },
      cartTotalUsd: Number(order.subtotal_usd),
      itemCount,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // ─── Graceful fallback · si PedidosYa env no está configurado
    // (sandbox sin credenciales · prod sin sign-up) · marcamos la orden
    // CONFIRMED (ya está) · loggeamos el event · staff hace dispatch
    // manual via la app PedidosYa o teléfono.
    if (message.startsWith("courier_env_missing:")) {
      await logEvent(supa, order.id, "COURIER_DISPATCHED", "system", {
        fallback: "pedidosya_not_configured",
        manual_dispatch_required: true,
        message: message,
      })
      await dispatchManualFallbackWhatsApp(
        order.customer_phone,
        orderCode,
      ).catch(() => {})
      return Response.json({
        ok: true,
        status: "CONFIRMED",
        reason: "pedidosya_not_configured_manual_fallback",
        message:
          "Sin credenciales PedidosYa · orden queda CONFIRMED · staff hace dispatch manual.",
      })
    }
    return Response.json(
      {
        ok: false,
        error: "quote_failed",
        detail: message,
      },
      { status: 502 },
    )
  }

  // ─── Crear pedido en PedidosYa Courier
  let dispatched: Awaited<ReturnType<typeof createPedidosYaOrder>>
  try {
    dispatched = await createPedidosYaOrder({
      quoteToken: quote.quoteToken,
      dropoff: {
        street: order.dropoff_detail ?? "Olón · ubicación compartida vía WhatsApp",
        detail: order.dropoff_detail ?? undefined,
        countryCode: "EC",
        latitude: Number(order.dropoff_lat),
        longitude: Number(order.dropoff_lng),
      },
      customer: {
        name: order.customer_name,
        phone: order.customer_phone,
        email: order.customer_email ?? undefined,
      },
      lines: cartLines.map(
        (l: { name?: string; qty?: number; priceUsd?: number }) => ({
          name: l.name ?? "ítem",
          qty: l.qty ?? 1,
          priceUsd: l.priceUsd ?? 0,
        }),
      ),
      notes: order.dropoff_detail ?? undefined,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return Response.json(
      { ok: false, error: "dispatch_failed", detail: message },
      { status: 502 },
    )
  }

  // ─── Actualizar la orden con datos del dispatch + transition ACCEPTED
  const newTotalUsd =
    Math.round(
      (Number(order.subtotal_usd) + Number(quote.priceUsd)) * 100,
    ) / 100

  const { error: updateErr } = await supa
    .from("orders")
    .update({
      status: "ACCEPTED",
      delivery_provider: "PEDIDOSYA_COURIER",
      delivery_provider_order_id: dispatched.orderId,
      delivery_provider_tracking_url: dispatched.trackingUrl ?? null,
      delivery_quote_token: quote.quoteToken,
      delivery_eta_minutes: quote.etaMinutes,
      delivery_fee_usd: quote.priceUsd,
      total_usd: newTotalUsd,
      accepted_at: new Date().toISOString(),
      raw_dispatch_response: dispatched.raw as object,
    })
    .eq("id", order.id)

  if (updateErr) {
    return Response.json(
      { ok: false, error: "update_failed", detail: updateErr.message },
      { status: 500 },
    )
  }

  await logEvent(supa, order.id, "COURIER_DISPATCHED", "system", {
    delivery_provider_order_id: dispatched.orderId,
    eta_minutes: quote.etaMinutes,
    delivery_fee_usd: quote.priceUsd,
    tracking_url: dispatched.trackingUrl ?? null,
  })

  // ─── Notificar al cliente · WhatsApp con ETA + tracking link
  void dispatchAcceptedWhatsApp(
    order.customer_phone,
    orderCode,
    quote.etaMinutes,
  ).catch(() => {})

  // ─── Trigger /api/notifications/order-status con ACCEPTED para que
  //     mande el template canónico del tracker (también enqueue para el
  //     dashboard tracker URL del cliente).
  void fetch(`${ORIGIN}/api/notifications/order-status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderCode, newStatus: "ACCEPTED" }),
    keepalive: true,
  }).catch(() => {})

  return Response.json({
    ok: true,
    status: "ACCEPTED",
    deliveryProviderOrderId: dispatched.orderId,
    etaMinutes: quote.etaMinutes,
    deliveryFeeUsd: quote.priceUsd,
    trackingUrl: dispatched.trackingUrl ?? null,
    totalUsd: newTotalUsd,
  })
}

// ────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────

async function logEvent(
  supa: ReturnType<typeof getSupabaseAdmin>,
  orderId: string,
  eventType: string,
  actor: string,
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await supa.from("order_events").insert({
      order_id: orderId,
      event_type: eventType,
      actor,
      payload,
    })
  } catch {
    // best-effort log · no romper el flow si el insert falla
  }
}

async function dispatchAcceptedWhatsApp(
  customerPhone: string,
  orderCode: string,
  etaMinutes: number,
): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWa = process.env.TWILIO_WHATSAPP_FROM
  if (!accountSid || !authToken || !fromWa) return

  const phone = customerPhone.replace(/^\+/, "")
  const message = [
    `✅ Pedido ${orderCode} aceptado por el motorizado`,
    ``,
    `Llega en ~${etaMinutes} minutos.`,
    `${ORIGIN}/order/${orderCode}`,
    ``,
    `Te aviso cuando esté cerca 📍`,
  ].join("\n")

  const params = new URLSearchParams({
    To: `whatsapp:+${phone}`,
    From: fromWa,
    Body: message,
  })
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  await fetch(
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
}

async function dispatchManualFallbackWhatsApp(
  customerPhone: string,
  orderCode: string,
): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWa = process.env.TWILIO_WHATSAPP_FROM
  if (!accountSid || !authToken || !fromWa) return

  const phone = customerPhone.replace(/^\+/, "")
  const message = [
    `Pedido ${orderCode} recibido completo 🌊`,
    ``,
    `Coordinamos el envío en minutos · te aviso cuando salga el motorizado.`,
  ].join("\n")

  const params = new URLSearchParams({
    To: `whatsapp:+${phone}`,
    From: fromWa,
    Body: message,
  })
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  await fetch(
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
}
