/**
 * Tracker stages canon · Round 103.
 *
 * Maps the 8-value `NaufragoOrderStatus` enum into 4 visual stages the
 * customer sees on `/order/[order_code]`. The mapping is intentional ·
 * lifecycle transitions like `ACCEPTED → PREPARING` happen kitchen-side
 * but from the customer perspective they belong to a single "your order
 * is being prepared" experience.
 *
 * Pattern reference · Domino's Pizza Tracker · 4 stages canonical
 * (research vault `2026-05-23-naufrago-tracker-domino-amazon-research.md`).
 */
import type { NaufragoOrderStatus } from "@/lib/schemas"

export type TrackerStageKey = "received" | "preparing" | "en_route" | "delivered"

export interface TrackerStage {
  key: TrackerStageKey
  /** Position in the progress bar · 1-4. */
  index: number
  /** Stage name shown in Bebas display font. */
  name: string
  /** Microcopy in Caveat cursive · per Emilio 2026-05-23 review. */
  microcopy: string
}

export const TRACKER_STAGES: TrackerStage[] = [
  {
    key: "received",
    index: 1,
    name: "Pedido recibido",
    microcopy: "Cocina ya tiene tu pedido",
  },
  {
    key: "preparing",
    index: 2,
    name: "Preparando",
    microcopy: "El cocinero está preparando tu pedido",
  },
  {
    key: "en_route",
    index: 3,
    name: "En camino",
    microcopy: "Tu canoa zarpó",
  },
  {
    key: "delivered",
    index: 4,
    name: "Entregado",
    microcopy: "Tu tesoro llegó · ¡salud!",
  },
]

/**
 * Project the canonical order status onto a visual stage.
 *
 *   PENDING            → received   (just submitted · kitchen not yet ack)
 *   ACCEPTED           → received   (kitchen confirmed but not started)
 *   PREPARING          → preparing
 *   READY              → preparing  (food ready · rider hasn't picked up · UX-wise still "kitchen done")
 *   RIDER_PICKED_UP    → en_route   (rider has the package · canoa zarpó)
 *   IN_TRANSIT         → en_route   (rider on the way)
 *   DELIVERED          → delivered
 *   CANCELLED          → handled separately by the UI (red banner · not a stage)
 */
export function stageForStatus(
  status: NaufragoOrderStatus | null | undefined,
): TrackerStageKey | "cancelled" {
  switch (status) {
    case "PENDING":
    case "ACCEPTED":
      return "received"
    case "PREPARING":
    case "READY":
      return "preparing"
    case "RIDER_PICKED_UP":
    case "IN_TRANSIT":
      return "en_route"
    case "DELIVERED":
      return "delivered"
    case "CANCELLED":
      return "cancelled"
    default:
      return "received"
  }
}

/**
 * 1-4 numeric position. `cancelled` is rendered separately by the UI.
 */
export function stageIndexForStatus(
  status: NaufragoOrderStatus | null | undefined,
): number {
  const key = stageForStatus(status)
  if (key === "cancelled") return 0
  return TRACKER_STAGES.find((s) => s.key === key)?.index ?? 1
}
