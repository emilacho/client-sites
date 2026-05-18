import { NextResponse } from "next/server"
import { courierOrderRequestSchema } from "@/lib/schemas"
import { createOrder } from "@/lib/courier/pedidosya-client"
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
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from("courier_orders").upsert(
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
    console.warn("[courier-order] supabase persist failed", err)
  }

  return NextResponse.json({
    ok: true,
    orderId: courierResult.orderId,
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
