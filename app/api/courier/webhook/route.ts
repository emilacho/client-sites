import { NextResponse } from "next/server"
import {
  courierWebhookEventSchema,
  type CourierWebhookEvent,
} from "@/lib/schemas"
import { verifyWebhookSignature } from "@/lib/courier/pedidosya-client"
import { getSupabaseAdmin } from "@/lib/supabase"

export const runtime = "nodejs"
// PedidosYa retries non-2xx responses · keep this route fast.
export const maxDuration = 10

/**
 * Round 74 · PedidosYa Courier · webhook receiver.
 *
 *   POST /api/courier/webhook
 *     headers · x-pedidosya-signature (TODO confirm header name)
 *     body    · raw JSON, schema enforced loose · we update
 *               courier_orders.status by orderId.
 *
 * Signature verification uses HMAC-SHA256 with the secret stored
 * in PEDIDOSYA_COURIER_WEBHOOK_SECRET. In non-production env, an
 * unsigned request is allowed for local testing (gated inside the
 * verifyWebhookSignature helper).
 *
 * Idempotency · the same event can arrive multiple times. We upsert
 * the status by pedidosya_order_id, so duplicates are no-ops. The
 * last_webhook_at timestamp moves forward each event so the most
 * recent one wins.
 */
export async function POST(request: Request) {
  // Read the raw body first · we need it for HMAC verification,
  // then parse JSON ourselves.
  const rawBody = await request.text()
  const signature =
    request.headers.get("x-pedidosya-signature") ??
    request.headers.get("x-signature")
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: "signature_invalid" },
      { status: 401 },
    )
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  // PedidosYa may wrap the event in different envelopes per
  // version (e.g. { data: {...} } or { event: ..., orderId: ... }).
  // Probe the most common shape, fall back to the raw object.
  let candidate: unknown = parsedJson
  if (
    typeof parsedJson === "object" &&
    parsedJson !== null &&
    "data" in parsedJson
  ) {
    candidate = (parsedJson as { data: unknown }).data
  }

  const parsed = courierWebhookEventSchema.safeParse(candidate)
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
  const event: CourierWebhookEvent = parsed.data

  try {
    const supabase = getSupabaseAdmin()
    await supabase
      .from("courier_orders")
      .update({
        status: event.status,
        last_webhook_at: new Date().toISOString(),
      })
      .eq("pedidosya_order_id", event.orderId)
    // Persist the full event log too (optional table for audit /
    // analytics · see migration TODO in /api/courier/order/route.ts).
    await supabase
      .from("courier_order_events")
      .insert({
        pedidosya_order_id: event.orderId,
        event: event.event,
        status: event.status,
        timestamp: event.timestamp ?? new Date().toISOString(),
        payload: event.payload ?? null,
      })
      .throwOnError()
      // Ignore "relation does not exist" pre-migration · don't fail
      // the webhook because the audit table isn't there yet.
      .then(undefined, (err: unknown) => {
        console.warn("[courier-webhook] event log skipped", err)
      })
  } catch (err) {
    console.warn("[courier-webhook] supabase update failed", err)
    // Even if persistence fails, return 200 so PedidosYa doesn't
    // hammer retries. We log and rely on subsequent events to
    // recover the state.
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/courier/webhook",
    method: "POST",
    runtime: "nodejs",
    description:
      "PedidosYa Courier · order status webhook · HMAC-verified.",
  })
}
