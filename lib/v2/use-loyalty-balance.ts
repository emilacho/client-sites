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
