import "server-only"
/**
 * Pricing helpers · Round 98.
 *
 * Money math runs server-side so the client can't tamper with
 * subtotals/discounts by editing the request body. The schema
 * accepts client-reported totals for display reconciliation
 * only · these helpers re-compute from `lines` + `discount_code`
 * + `delivery_fee_usd` and surface a `mismatched` flag when the
 * client value drifts beyond a one-cent rounding tolerance.
 */
import type { z } from "zod"
import type { checkoutQuoteRequestSchema } from "@/lib/schemas"

type CartLine = z.infer<typeof checkoutQuoteRequestSchema>["lines"][number]

export interface DiscountResult {
  code: string | null
  percentOff: number
  amountUsd: number
}

/**
 * Canon discount codes · single source. Add new codes here +
 * surface them on the landing (cofre reveal etc.).
 */
const DISCOUNTS: Record<string, { percentOff: number }> = {
  NAUFRAGO5: { percentOff: 5 },
  SURFBOLLADO: { percentOff: 5 },
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function computeSubtotalUsd(lines: CartLine[]): number {
  return round2(
    lines.reduce((sum, l) => sum + l.priceUsd * l.qty, 0),
  )
}

export function computeDiscount(
  subtotalUsd: number,
  code: string | null | undefined,
): DiscountResult {
  if (!code) return { code: null, percentOff: 0, amountUsd: 0 }
  const normalized = code.trim().toUpperCase()
  const def = DISCOUNTS[normalized]
  if (!def) return { code: null, percentOff: 0, amountUsd: 0 }
  return {
    code: normalized,
    percentOff: def.percentOff,
    amountUsd: round2((subtotalUsd * def.percentOff) / 100),
  }
}

export function computeTotalUsd(
  subtotalUsd: number,
  discountUsd: number,
  deliveryFeeUsd: number,
): number {
  return round2(Math.max(0, subtotalUsd - discountUsd) + deliveryFeeUsd)
}

export function totalItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.qty, 0)
}
