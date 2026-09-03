"use client"
/**
 * useLoyaltyBalance · R96.21 · lookup balance perlas por phone.
 *
 * Debounce 600ms al input change · cache local · no spammea
 * `/api/loyalty/[phone]`. Auto-no-op si phone < 8 dígitos.
 */
import { useEffect, useState } from "react"

const PERLA_VALUE_USD = 0.01

export interface LoyaltyBalance {
  phone: string
  perlas: number
  earnedTotal: number
  spentTotal: number
}

export function perlasToUsd(perlas: number): number {
  return Math.round(perlas * PERLA_VALUE_USD * 100) / 100
}

/** R96.24 · redemption catalog · mismo data que server-side ·
 *  duplicated client-side para evitar importar server lib en
 *  client component. Mantener sync con lib/loyalty-server.ts. */
export type LoyaltyRewardType = "percent_off" | "free_item"

export interface LoyaltyReward {
  id: string
  cost: number
  type: LoyaltyRewardType
  label: string
  description: string
  percentOff?: number
  freeItemId?: string
}

// R157 · el catálogo de premios se fue a `lib/perlas.ts`, donde ya vive
// la regla de las perlas. Había DOS copias escritas a mano -esta y la del
// servidor- y nada obligaba a que dijeran lo mismo.

export function useLoyaltyBalance(rawPhone: string): {
  balance: LoyaltyBalance | null
  loading: boolean
} {
  const [balance, setBalance] = useState<LoyaltyBalance | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const digits = rawPhone.replace(/\D/g, "")
    if (digits.length < 8) {
      setBalance(null)
      return
    }
    setLoading(true)
    const id = window.setTimeout(async () => {
      try {
        const res = await fetch(`/api/loyalty/${encodeURIComponent(digits)}`)
        const data = await res.json()
        if (data?.ok) {
          setBalance({
            phone: data.phone,
            perlas: data.perlas ?? 0,
            earnedTotal: data.earnedTotal ?? 0,
            spentTotal: data.spentTotal ?? 0,
          })
        } else {
          setBalance(null)
        }
      } catch {
        setBalance(null)
      } finally {
        setLoading(false)
      }
    }, 600)
    return () => window.clearTimeout(id)
  }, [rawPhone])

  return { balance, loading }
}
