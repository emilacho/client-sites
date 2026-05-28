import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import {
  stageForStatus,
  stageIndexForStatus,
} from "@/lib/tracker/stages"
import type { NaufragoOrderStatus } from "@/lib/schemas"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/orders/[order_code]
 *
 * Read-only public endpoint consumed by `/order/[order_code]` tracker
 * page · polls every 30s for state changes. Returns the minimum shape
 * the UI needs · no sensitive payment data leaked.
 *
 * The `canoa_pct` field is the centerpiece of Round 103 · the en-route
 * canoa scene moves left-to-right based on this value (0-100). Source
 * of truth ·
 *
 *   - If `rider_info.distance_remaining_m` + the order's
 *     `dropoff_lat/lng` + the courier's pickup origin are known, compute
 *     `(total - remaining) / total * 100`.
 *   - Else fall back to a time-based estimate · status was
 *     RIDER_PICKED_UP at `rider_picked_up_at` · expected
 *     `delivery_eta_minutes` after that · `pct = clamp((now -
 *     rider_picked_up_at) / (eta_min * 60_000) * 100, 0, 100)`.
 *
 * For statuses before `RIDER_PICKED_UP` the field returns 0 (canoa
 * hasn't departed). For `DELIVERED` it returns 100.
 */
interface RiderInfoShape {
  name?: string
  phone?: string
  plate?: string
  vehicleType?: string
  distance_remaining_m?: number
  total_distance_m?: number
}

interface OrderRow {
  id: string
  order_code: string
  status: NaufragoOrderStatus
  customer_name: string
  customer_phone: string
  cart_lines: Array<{ id: string; name: string; priceUsd: number; qty: number }>
  subtotal_usd: number
  discount_code: string | null
  discount_usd: number
  delivery_fee_usd: number
  total_usd: number
  delivery_provider: string
  delivery_provider_tracking_url: string | null
  delivery_eta_minutes: number | null
  rider_info: RiderInfoShape | null
  customer_notes: string | null
  created_at: string
  rider_picked_up_at: string | null
  in_transit_at: string | null
  delivered_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  delivery_photo_url: string | null
  delivery_photo_lat: number | null
  delivery_photo_lng: number | null
  delivery_photo_at: string | null
}

function computeCanoaPct(row: OrderRow): number {
  if (row.status === "DELIVERED") return 100
  const stage = stageForStatus(row.status)
  if (stage !== "en_route") return 0

  const rider = row.rider_info
  if (
    rider &&
    typeof rider.distance_remaining_m === "number" &&
    typeof rider.total_distance_m === "number" &&
    rider.total_distance_m > 0
  ) {
    const traveled = rider.total_distance_m - rider.distance_remaining_m
    const pct = (traveled / rider.total_distance_m) * 100
    return Math.max(0, Math.min(100, pct))
  }

  // Time-based fallback when no GPS distance data yet (e.g. PedidosYa
  // hasn't sent the position webhook · or alta pending).
  const pickupTs = row.rider_picked_up_at
    ? new Date(row.rider_picked_up_at).getTime()
    : null
  if (!pickupTs) return 0
  const etaMin = row.delivery_eta_minutes ?? 20
  const elapsed = (Date.now() - pickupTs) / 60_000
  const pct = (elapsed / etaMin) * 100
  return Math.max(0, Math.min(100, pct))
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ order_code: string }> },
) {
  const { order_code } = await context.params
  if (!order_code || !/^NF-\d{4}-[A-Z0-9]{6}$/i.test(order_code)) {
    return NextResponse.json(
      { error: "invalid_order_code", detail: "Format expected NF-YYYY-XXXXXX" },
      { status: 400 },
    )
  }

  const supabase = getSupabaseAdmin()
  const { data, error } = await supabase
    .from("orders")
    .select(
      "id, order_code, status, customer_name, customer_phone, cart_lines, subtotal_usd, discount_code, discount_usd, delivery_fee_usd, total_usd, delivery_provider, delivery_provider_tracking_url, delivery_eta_minutes, rider_info, customer_notes, created_at, rider_picked_up_at, in_transit_at, delivered_at, cancelled_at, cancellation_reason, delivery_photo_url, delivery_photo_lat, delivery_photo_lng, delivery_photo_at",
    )
    .eq("order_code", order_code.toUpperCase())
    .maybeSingle()

  if (error) {
    return NextResponse.json(
      { error: "fetch_failed", detail: error.message },
      { status: 500 },
    )
  }
  if (!data) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  const row = data as OrderRow
  const stage = stageForStatus(row.status)
  const stageIndex = stageIndexForStatus(row.status)
  const canoaPct = computeCanoaPct(row)

  return NextResponse.json({
    ok: true,
    order_code: row.order_code,
    status: row.status,
    stage,
    stage_index: stageIndex,
    canoa_pct: canoaPct,
    customer_name: row.customer_name,
    customer_phone: row.customer_phone,
    cart_lines: row.cart_lines,
    subtotal_usd: row.subtotal_usd,
    discount_code: row.discount_code,
    discount_usd: row.discount_usd,
    delivery_fee_usd: row.delivery_fee_usd,
    total_usd: row.total_usd,
    delivery_provider: row.delivery_provider,
    delivery_eta_minutes: row.delivery_eta_minutes,
    rider_info: row.rider_info,
    customer_notes: row.customer_notes,
    created_at: row.created_at,
    rider_picked_up_at: row.rider_picked_up_at,
    delivered_at: row.delivered_at,
    cancelled_at: row.cancelled_at,
    cancellation_reason: row.cancellation_reason,
    delivery_photo_url: row.delivery_photo_url,
    delivery_photo_lat: row.delivery_photo_lat,
    delivery_photo_lng: row.delivery_photo_lng,
    delivery_photo_at: row.delivery_photo_at,
  })
}
