"use client"
/**
 * useLastOrder · Round 96.9 · pattern Domino's "Your usual order".
 *
 * Persiste el último pedido del usuario en localStorage para que
 * pueda re-ordenar lo mismo en un click desde el hero. TTL 30 días
 * · TTL-expired entries se borran al leer.
 *
 * Save points ·
 *  - PedidosYa flow · confirmOrder() success (orderCode known)
 *  - WhatsApp flow · onClick del CTA WA (intent · sin orderCode
 *    porque la confirmación real ocurre en el chat externo)
 *
 * Load · useLastOrder() en el hero · renderiza condicionalmente
 * el 4to CTA "Pide lo mismo" cuando hay un last-order válido.
 */
import { useCallback, useEffect, useState } from "react"
import type { CartLine } from "./cart-context"

const KEY = "nf:last-order"
const TTL_DAYS = 30

export interface LastOrder {
  /** PedidosYa flow lo setea · WhatsApp flow null (intent-only). */
  orderCode: string | null
  lines: CartLine[]
  totalUsd: number
  createdAt: number
}

interface CachedLastOrder extends Omit<LastOrder, "lines"> {
  lines: unknown[]
}

function isLine(x: unknown): x is CartLine {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.priceUsd === "number" &&
    typeof o.qty === "number"
  )
}

export function saveLastOrder(order: Omit<LastOrder, "createdAt">): void {
  if (typeof window === "undefined") return
  try {
    const payload: LastOrder = { ...order, createdAt: Date.now() }
    window.localStorage.setItem(KEY, JSON.stringify(payload))
  } catch {
    // quota exceeded · privacy mode · disabled storage · silently skip
  }
}

export function useLastOrder(): { order: LastOrder | null; clear: () => void } {
  const [order, setOrder] = useState<LastOrder | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(KEY)
      if (!raw) return
      const parsed = JSON.parse(raw) as CachedLastOrder
      if (
        typeof parsed.createdAt !== "number" ||
        typeof parsed.totalUsd !== "number" ||
        !Array.isArray(parsed.lines)
      ) {
        window.localStorage.removeItem(KEY)
        return
      }
      // TTL expired · expire silently
      if (Date.now() - parsed.createdAt > TTL_DAYS * 86_400_000) {
        window.localStorage.removeItem(KEY)
        return
      }
      const lines = parsed.lines.filter(isLine)
      if (lines.length === 0) {
        window.localStorage.removeItem(KEY)
        return
      }
      setOrder({
        orderCode: typeof parsed.orderCode === "string" ? parsed.orderCode : null,
        lines,
        totalUsd: parsed.totalUsd,
        createdAt: parsed.createdAt,
      })
    } catch {
      // corrupt JSON · drop
      try {
        window.localStorage.removeItem(KEY)
      } catch {}
    }
  }, [])

  const clear = useCallback(() => {
    if (typeof window === "undefined") return
    try {
      window.localStorage.removeItem(KEY)
    } catch {}
    setOrder(null)
  }, [])

  return { order, clear }
}
