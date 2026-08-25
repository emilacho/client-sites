import { NextResponse } from "next/server"
import { courierOrderRequestSchema } from "@/lib/schemas"
import { createOrder } from "@/lib/courier/para-rutas"
import { getSupabaseAdmin } from "@/lib/supabase"
import { cliente } from "@/cliente.config"

export const runtime = "nodejs"

/**
 * Round 74 · PedidosYa Courier · create order endpoint.
 *
 *   POST /api/courier/order
 *     body  · { quoteToken, dropoff, customer, lines, notes? }
 *     resp  · { ok: true, orderId, trackingUrl?, status }
 *
 * Two-step responsibility:
 *   1. Promote the saved quote → real PedidosYa order
 *   2. Persist the order to `courier_orders` (Supabase) so the
 *      webhook handler can match incoming status events.
 *
 * The Supabase table is referenced but NOT migrated in this round
 * · the schema lives at TODO(R74-migration) below for the
 * follow-up commit:
 *
 *   create table courier_orders (
 *     id              uuid primary key default gen_random_uuid(),
 *     client_slug     text not null,
 *     pedidosya_order_id text unique not null,
 *     quote_token     text not null,
 *     status          text not null default 'CREATED',
 *     customer_name   text,
 *     customer_phone  text,
 *     customer_email  text,
 *     dropoff_address text,
 *     cart_lines      jsonb,
 *     notes           text,
 *     tracking_url    text,
 *     raw_create_response jsonb,
 *     last_webhook_at timestamptz,
 *     created_at      timestamptz default now()
 *   );
 *
 * If the table doesn't exist yet (pre-migration), the persist step
 * logs the error and still returns the courier response so the
 * customer flow isn't blocked.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = courierOrderRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }
  const { quoteToken, dropoff, customer, lines, notes } = parsed.data

  let courierResult
  try {
    courierResult = await createOrder({
      quoteToken,
      dropoff,
      customer,
      lines: lines.map((l) => ({ name: l.name, qty: l.qty, priceUsd: l.priceUsd })),
      notes,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const status = message.startsWith("courier_env_missing:") ? 503 : 502
    return NextResponse.json(
      { error: "order_failed", detail: message },
      { status },
    )
  }

  // Best-effort persist · don't block the customer on Supabase
  // errors. The webhook handler will create the row if it arrives
  // before this insert (idempotent on pedidosya_order_id).
  // R106 · courier_orders vive en el esquema `naufrago`, como el resto
  // del cliente. Antes apuntaba a `public` (legado R74) · esa tabla nunca
  // llegó a crearse, y de haberse creado ahí habría quedado publicada
  // hacia afuera con nombre, teléfono y dirección del cliente adentro.
  const supabase = getSupabaseAdmin()
  try {
    await supabase
      .from("courier_orders")
      .upsert(
        {
          client_slug: cliente.slug,
          pedidosya_order_id: courierResult.orderId,
          quote_token: quoteToken,
          status: courierResult.status,
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email || null,
          dropoff_address: dropoff.street,
          cart_lines: lines,
          notes: notes || null,
          tracking_url: courierResult.trackingUrl ?? null,
          raw_create_response: courierResult.raw as object,
        },
        { onConflict: "pedidosya_order_id" },
      )
  } catch (err) {
    // Swallow · log on the server but proceed with success response.
    console.warn("[courier-order] courier_orders persist failed", err)
  }

  // R97.5 · ALSO insert into naufrago.orders (R96 canonical table)
  // para que tracker /order/[code] + WhatsApp templates + geofencing
  // funcionen. En MOCK MODE inicializamos en ACCEPTED + payment CAPTURED
  // (simulando Kushki capture + courier dispatch). En real flow lo
  // dejaríamos PENDING hasta que llegue confirmación PedidosYa real.
  const mockMode = process.env.PEDIDOSYA_COURIER_MOCK === "true"
  const cartTotalUsd = lines.reduce((s, l) => s + l.priceUsd * l.qty, 0)

  // R107 · el envío SÍ se cobra. Hasta hoy esta fila guardaba
  // delivery_fee_usd = 0 y total = comida, así que el pedido quedaba
  // registrado por menos de lo que costaba y la cocina veía un total
  // que no cerraba. La cifra viene del DESPACHO (route.pricing.total),
  // que es la que PedidosYa confirmó · no la del navegador ni la de
  // una re-cotización, que podrían diferir de lo cobrado.
  const deliveryFeeUsd = courierResult.priceUsd ?? 0
  const totalUsd = Number((cartTotalUsd + deliveryFeeUsd).toFixed(2))
  const etaMinutes = courierResult.etaMinutes ?? null
  const { generateOrderCode } = await import("@/lib/checkout/order-code")
  const orderCode = generateOrderCode()
  let naufragoOrderId: string | null = null
  try {
    const { data: inserted } = await supabase
      .from("orders")
      .insert({
        client_slug: cliente.slug,
        order_code: orderCode,
        status: mockMode ? "ACCEPTED" : "PENDING",
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email || null,
        dropoff_address: dropoff.street,
        dropoff_detail: dropoff.detail || null,
        dropoff_lat: dropoff.latitude ?? null,
        dropoff_lng: dropoff.longitude ?? null,
        dropoff_country_code: dropoff.countryCode ?? "EC",
        cart_lines: lines,
        subtotal_usd: cartTotalUsd,
        delivery_fee_usd: deliveryFeeUsd,
        total_usd: totalUsd,
        delivery_eta_minutes: etaMinutes,
        delivery_provider: "PEDIDOSYA_COURIER",
        delivery_provider_order_id: courierResult.orderId,
        delivery_provider_tracking_url: courierResult.trackingUrl ?? null,
        delivery_quote_token: quoteToken,
        // R107 · antes decía "CARD_DEBIT" fijo · era falso: no hay
        // pasarela de tarjeta conectada, así que ningún pedido se pagó
        // con débito. La cocina lo leía como cobrado por adelantado.
        // Lo que existe hoy es efectivo contra entrega.
        payment_method: "CASH_ON_DELIVERY",
        payment_status: mockMode ? "CAPTURED" : "PENDING",
        payment_provider: mockMode ? "KUSHKI" : null,
        customer_notes: notes || null,
        accepted_at: mockMode ? new Date().toISOString() : null,
        raw_dispatch_response: courierResult.raw as object,
      })
      .select("id, order_code")
      .single()
    if (inserted) {
      naufragoOrderId = inserted.id
      // Trigger WhatsApp template ACCEPTED para que el cliente
      // reciba la primera notificación · idempotente via R96.110.
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ?? "https://naufrago.delivery"
      void fetch(`${origin}/api/notifications/order-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderCode, newStatus: "ACCEPTED" }),
        keepalive: true,
      }).catch(() => {})
      // Log event
      await supabase.from("order_events").insert({
        order_id: inserted.id,
        event_type: "ORDER_CREATED",
        actor: "system",
        payload: {
          mock_mode: mockMode,
          subtotal_usd: cartTotalUsd,
          delivery_fee_usd: deliveryFeeUsd,
          total_usd: totalUsd,
        },
      })
    }
  } catch (err) {
    console.warn("[courier-order] naufrago.orders persist failed", err)
  }

  return NextResponse.json({
    ok: true,
    orderId: courierResult.orderId,
    orderCode,
    naufragoOrderId,
    trackingUrl: courierResult.trackingUrl,
    status: courierResult.status,
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/courier/order",
    method: "POST",
    runtime: "nodejs",
    description:
      "PedidosYa Courier · promote quote to real delivery order · persists to courier_orders.",
    body_shape: {
      quoteToken: "string · from /api/courier/quote",
      dropoff: "address object",
      customer: "{ name, phone, email? }",
      lines: "cart lines array",
      notes: "string (optional)",
    },
  })
}
