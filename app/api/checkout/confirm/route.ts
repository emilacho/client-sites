import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { checkoutConfirmRequestSchema } from "@/lib/schemas"
import { cliente } from "@/cliente.config"
import {
  computeDiscount,
  computeSubtotalUsd,
  computeTotalUsd,
} from "@/lib/checkout/pricing"
import { generateOrderCode } from "@/lib/checkout/order-code"

export const runtime = "nodejs"

/**
 * Round 98 · POST /api/checkout/confirm
 *
 * The customer has picked a delivery option + a payment method.
 * This route is the order's birth certificate:
 *   1. Validates the request body.
 *   2. Re-computes money math server-side (anti-tamper).
 *   3. Inserts the `naufrago_orders` row at status=PENDING +
 *      payment_status=PENDING.
 *   4. Inserts a `naufrago_order_events.ORDER_CREATED` audit row.
 *   5. Returns the new id, the human-friendly order_code, and the
 *      redirect URL where the tracker lives.
 *
 * Side-effects intentionally NOT performed in this round:
 *   • Payment intent creation · waits on R101 (Kushki PaymentProvider).
 *   • Courier dispatch · waits until payment is captured (R99 + R101).
 * Keeping confirm cheap means a half-failed payment flow doesn't
 * orphan a dispatched rider.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = checkoutConfirmRequestSchema.safeParse(body)
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
  const data = parsed.data

  // ── Re-compute money math server-side · client values are
  // display-only and we ignore them on the persisted row.
  const subtotalUsd = computeSubtotalUsd(data.lines)
  const discount = computeDiscount(subtotalUsd, data.discountCode || null)
  // Delivery fee is 0 at confirm time · the real fee is locked in
  // when the courier dispatch fires (R99). We track the chosen
  // provider + quote token here so dispatch can re-use them.
  const deliveryFeeUsd = 0
  const totalUsd = computeTotalUsd(subtotalUsd, discount.amountUsd, deliveryFeeUsd)

  const orderCode = generateOrderCode()
  const supabase = getSupabaseAdmin()

  const { data: inserted, error: insertErr } = await supabase
    .from("naufrago_orders")
    .insert({
      client_slug: cliente.slug,
      order_code: orderCode,
      source: "NAUFRAGO_LANDING",
      status: "PENDING",
      customer_name: data.customer.name,
      customer_phone: data.customer.phone,
      customer_email: data.customer.email || null,
      dropoff_address: data.dropoff.street,
      dropoff_detail: data.dropoff.detail || null,
      dropoff_lat: data.dropoff.latitude ?? null,
      dropoff_lng: data.dropoff.longitude ?? null,
      dropoff_country_code: data.dropoff.countryCode ?? "EC",
      cart_lines: data.lines,
      subtotal_usd: subtotalUsd,
      discount_code: discount.code,
      discount_usd: discount.amountUsd,
      delivery_fee_usd: deliveryFeeUsd,
      total_usd: totalUsd,
      delivery_provider: data.deliveryProvider,
      delivery_quote_token: data.deliveryQuoteToken,
      payment_method: data.paymentMethod,
      payment_status: "PENDING",
      payment_provider_intent_id: data.paymentProviderIntentId || null,
      customer_notes: data.customerNotes || null,
    })
    .select("id, order_code, created_at")
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "persist_failed", detail: insertErr?.message },
      { status: 500 },
    )
  }

  // Audit event · ORDER_CREATED · best-effort. If it fails we still
  // return success for the order itself · the event log is for
  // observability, not for the order to exist.
  const { error: eventErr } = await supabase
    .from("naufrago_order_events")
    .insert({
      order_id: inserted.id,
      event_type: "ORDER_CREATED",
      actor: "system",
      payload: {
        subtotal_usd: subtotalUsd,
        discount_usd: discount.amountUsd,
        delivery_provider: data.deliveryProvider,
        payment_method: data.paymentMethod,
      },
    })
  // Non-fatal · surfaced in the response for the operator to notice.
  const audit_warning = eventErr ? eventErr.message : null

  // R96.106 · perfil silencioso del cliente (Domino's pattern) + Easy
  // Order. Lógica encapsulada en /api/easy-order/save para reusarse
  // desde courier/order también · ver helper en app/api/easy-order/save/route.ts.
  // Acá best-effort fire-and-forget · no bloquea la creación de la orden.

  // R96.105 · tracking re-uso de códigos promo · regla 24h + $25.
  //   - Si discount aplicado · UPSERT row con last_used_at=now, spend=0, use_count++
  //   - Si NO discount · si existe row del cliente para CUALQUIER code,
  //     incrementar qualifying_spend_since_last_use += subtotalUsd
  // Errores acá NO bloquean la creación de la orden · best-effort.
  try {
    const phone = data.customer.phone
    if (phone) {
      if (discount.code) {
        const codeUpper = discount.code.toUpperCase()
        // Check existing use_count para bump correcto.
        const { data: existing } = await supabase
          .from("naufrago_promo_usage")
          .select("use_count")
          .eq("client_slug", cliente.slug)
          .eq("whatsapp_e164", phone)
          .eq("code", codeUpper)
          .limit(1)
          .maybeSingle()
        const nextUseCount = (existing?.use_count ?? 0) + 1
        await supabase
          .from("naufrago_promo_usage")
          .upsert(
            {
              client_slug: cliente.slug,
              whatsapp_e164: phone,
              code: codeUpper,
              last_used_at: new Date().toISOString(),
              qualifying_spend_since_last_use: 0,
              use_count: nextUseCount,
            },
            { onConflict: "client_slug,whatsapp_e164,code" },
          )
      } else {
        // Sumar el subtotal al qualifying spend de TODAS las rows
        // del cliente · qualquier código que tenga acumulando.
        const { data: rows } = await supabase
          .from("naufrago_promo_usage")
          .select("id, qualifying_spend_since_last_use")
          .eq("client_slug", cliente.slug)
          .eq("whatsapp_e164", phone)
        if (rows && rows.length > 0) {
          for (const row of rows) {
            await supabase
              .from("naufrago_promo_usage")
              .update({
                qualifying_spend_since_last_use:
                  Number(row.qualifying_spend_since_last_use ?? 0) + subtotalUsd,
              })
              .eq("id", row.id)
          }
        }
      }
    }
  } catch {
    // best-effort · no bloquear la creación de la orden
  }

  return NextResponse.json({
    ok: true,
    order_id: inserted.id,
    order_code: inserted.order_code,
    status: "PENDING",
    payment_status: "PENDING",
    subtotal_usd: subtotalUsd,
    discount_usd: discount.amountUsd,
    delivery_fee_usd: deliveryFeeUsd,
    total_usd: totalUsd,
    redirect_url: `/order/${inserted.order_code}`,
    audit_warning,
  })
}

export function GET() {
  return NextResponse.json({
    endpoint: "/api/checkout/confirm",
    method: "POST",
    runtime: "nodejs",
    description:
      "Confirma checkout · re-computa subtotal/discount/total server-side · inserta naufrago_orders row + audit event ORDER_CREATED · NO dispatches courier ni cobra payment (eso pasa post-payment-captured en R99+R101).",
    body_shape: {
      dropoff: "addressSchema · street + detail + countryCode + lat/lng",
      lines: "array · [{ id, name, priceUsd, qty }]",
      customer: "{ name, phone, email? }",
      deliveryProvider: "PEDIDOSYA_COURIER | RAPPI_COURIER | UBER_EATS_COURIER | NAUFRAGO_OWN_DELIVERY | PICKUP",
      deliveryQuoteToken: "string (from /api/checkout/quote)",
      paymentMethod: "GOOGLE_PAY | APPLE_PAY | CARD_CREDIT | CARD_DEBIT | PAYPHONE | CASH_ON_DELIVERY | WHATSAPP_MANUAL | BANK_TRANSFER",
      paymentProviderIntentId: "string (optional · provided when gateway already tokenized)",
      subtotalUsd: "number (display only · server re-computes)",
      discountCode: "string (optional)",
      customerNotes: "string (optional, max 500)",
    },
  })
}
