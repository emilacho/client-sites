"use client"
/**
 * useEasyOrder · R96.106 · "Hambre de Náufrago" estilo Domino's Easy Order.
 *
 * Lee el whatsapp del cliente cacheado en localStorage (set en
 * checkout post-confirm) · fetchea /api/easy-order?whatsapp=...
 * Devuelve el Easy Order del cliente o null si no hay perfil aún.
 * Cross-device · sirve para mostrar el CTA "Hambre de Náufrago" en
 * landings de cualquier device donde el cliente abra con su number.
 */
import { useEffect, useState } from "react"

export interface EasyOrderLine {
  id: string
  name: string
  priceUsd: number
  qty: number
}

export interface EasyOrder {
  nickname: string
  cart_lines: EasyOrderLine[]
  dropoff: {
    street?: string
    detail?: string | null
    latitude?: number | null
    longitude?: number | null
    countryCode?: string | null
  } | null
  payment_method: string | null
  delivery_provider: string | null
  total_usd: number | null
  source_order_code: string | null
  updated_at: string
}

const CACHE_KEY = "naufrago_customer_whatsapp"

export function useEasyOrder() {
  const [easyOrder, setEasyOrder] = useState<EasyOrder | null>(null)
  const [loading, setLoading] = useState(false)
  const [whatsapp, setWhatsapp] = useState<string | null>(null)

  useEffect(() => {
    try {
      const cached = window.localStorage.getItem(CACHE_KEY)
      if (!cached) return
      setWhatsapp(cached)
      setLoading(true)
      fetch(`/api/easy-order?whatsapp=${encodeURIComponent(cached)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.ok && data.easyOrder) {
            setEasyOrder(data.easyOrder as EasyOrder)
          }
        })
        .catch(() => {
          // ignore network errors · silent fallback
        })
        .finally(() => setLoading(false))
    } catch {
      // ignore quota errors
    }
  }, [])

  return { easyOrder, loading, whatsapp }
}
