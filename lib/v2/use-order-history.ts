"use client"
/**
 * useOrderHistory · R96.115 · Fase C · histórico paginado del cliente.
 * Fetcha via GET /api/orders/by-account con cursor-based pagination
 * (orderCode del último item como ?before=...).
 */
import { useCallback, useEffect, useState } from "react"
import { getSupabaseBrowser } from "@/lib/supabase-browser"

export interface OrderHistoryLine {
  id: string
  name: string
  priceUsd: number
  qty: number
  notes?: string
  customizations?: Array<{ id: string; label: string; priceDelta: number }>
}

export interface OrderHistoryItem {
  order_code: string
  status: string
  total_usd: number
  subtotal_usd: number
  cart_lines: OrderHistoryLine[]
  created_at: string
  delivered_at: string | null
}

const PAGE_SIZE = 20

export function useOrderHistory(): {
  orders: OrderHistoryItem[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string | null
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
} {
  const [orders, setOrders] = useState<OrderHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPage = useCallback(
    async (before: string | null): Promise<{
      orders: OrderHistoryItem[]
      hasMore: boolean
    } | null> => {
      const supa = getSupabaseBrowser()
      const {
        data: { session },
      } = await supa.auth.getSession()
      if (!session?.access_token) return null
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
      if (before) params.set("before", before)
      const res = await fetch(`/api/orders/by-account?${params.toString()}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!data?.ok) return null
      return {
        orders: (data.orders ?? []) as OrderHistoryItem[],
        hasMore: !!data.hasMore,
      }
    },
    [],
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await fetchPage(null)
      if (!page) {
        setOrders([])
        setHasMore(false)
        return
      }
      setOrders(page.orders)
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [fetchPage])

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || orders.length === 0) return
    setLoadingMore(true)
    setError(null)
    try {
      const last = orders[orders.length - 1]
      const page = await fetchPage(last.order_code)
      if (!page) return
      setOrders((prev) => [...prev, ...page.orders])
      setHasMore(page.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoadingMore(false)
    }
  }, [orders, hasMore, loadingMore, fetchPage])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { orders, loading, loadingMore, hasMore, error, loadMore, refresh }
}
