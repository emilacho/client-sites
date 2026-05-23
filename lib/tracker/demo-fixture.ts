/**
 * Demo fixture · R103 visual validation · NO Supabase required.
 *
 * Permite a Emilio (o reviewer interno) abrir `/order/DEMO?demo=stageN`
 * y ver cada stage del tracker con datos sintéticos · útil para iterar
 * microcopy/colores/timing sin crear órdenes reales. Server-side only
 * (page.tsx detecta `?demo=` y bypasea fetch a Supabase).
 *
 * NO se expone en runtime de producción a clientes reales · sólo
 * cualquiera que conozca el código de pedido literal "DEMO" lo puede
 * activar · zero impacto en órdenes reales.
 */
import type { NaufragoOrderStatus } from "@/lib/schemas"
import { stageForStatus, stageIndexForStatus } from "./stages"

type DemoStage = "1" | "2" | "3" | "4" | "cancelled"

const STATUS_PER_STAGE: Record<DemoStage, NaufragoOrderStatus> = {
  "1": "PENDING",
  "2": "PREPARING",
  "3": "IN_TRANSIT",
  "4": "DELIVERED",
  cancelled: "CANCELLED",
}

const CART_LINES = [
  { id: "encebollado", name: "Encebollado Náufrago", priceUsd: 6.5, qty: 2 },
  { id: "ceviche", name: "Ceviche de Camarón", priceUsd: 8.0, qty: 1 },
]

function isDemoStage(value: string | undefined): value is DemoStage {
  return value === "1" || value === "2" || value === "3" || value === "4" || value === "cancelled"
}

export function buildDemoSnapshot(stageParam: string | undefined) {
  const stageKey: DemoStage = isDemoStage(stageParam) ? stageParam : "1"
  const status = STATUS_PER_STAGE[stageKey]

  // canoa_pct · forced to 35% en stage 3 (canoa visible mid-trip) · 100 en
  // stage 4 · 0 en el resto.
  let canoaPct = 0
  if (stageKey === "3") canoaPct = 35
  else if (stageKey === "4") canoaPct = 100

  // Synthetic timestamps · all anchored to "now" so ETAs computan
  // razonable visualmente.
  const now = Date.now()
  const createdAt = new Date(now - 12 * 60_000).toISOString()
  const riderPickedUpAt =
    stageKey === "3" || stageKey === "4"
      ? new Date(now - 5 * 60_000).toISOString()
      : null
  const deliveredAt = stageKey === "4" ? new Date(now - 1 * 60_000).toISOString() : null
  const cancelledAt = stageKey === "cancelled" ? new Date(now - 2 * 60_000).toISOString() : null

  const subtotal = CART_LINES.reduce((s, l) => s + l.priceUsd * l.qty, 0)
  const discount = 1.05
  const deliveryFee = 2.5
  const total = subtotal - discount + deliveryFee

  return {
    ok: true as const,
    order_code: "DEMO-2026-PREVIEW",
    status,
    stage: stageForStatus(status),
    stage_index: stageIndexForStatus(status),
    canoa_pct: canoaPct,
    customer_name: "Visitante Sintético",
    customer_phone: "+593990000000",
    cart_lines: CART_LINES,
    subtotal_usd: subtotal,
    discount_code: "SURFBOLLADO",
    discount_usd: discount,
    delivery_fee_usd: deliveryFee,
    total_usd: total,
    delivery_provider: "PEDIDOSYA_COURIER" as const,
    delivery_eta_minutes: 20,
    rider_info:
      stageKey === "3"
        ? {
            name: "Juan C.",
            phone: "+593997744288",
            plate: "ABC-123",
            vehicleType: "moto",
          }
        : null,
    customer_notes: null,
    created_at: createdAt,
    rider_picked_up_at: riderPickedUpAt,
    delivered_at: deliveredAt,
    cancelled_at: cancelledAt,
    cancellation_reason: stageKey === "cancelled" ? "Cliente canceló · sin razón" : null,
    // R96.18 · demo · stage 4 muestra foto proof of delivery con un
    // stock food image · coords cerca Olón (-1.79, -80.75) · timestamp
    // = delivered_at.
    delivery_photo_url:
      stageKey === "4"
        ? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=70&auto=format"
        : null,
    delivery_photo_lat: stageKey === "4" ? -1.79135 : null,
    delivery_photo_lng: stageKey === "4" ? -80.75612 : null,
    delivery_photo_at: stageKey === "4" ? deliveredAt : null,
  }
}
