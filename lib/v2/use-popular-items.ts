"use client"
/**
 * usePopularItems · R96.22 · top 3 items 30d window.
 *
 * Cache localStorage 5min · evita re-fetch al re-abrir MenuModal.
 * Fetch /api/menu/popular · siempre responde 3 items (live o fallback).
 */
import { useEffect, useState } from "react"

const CACHE_KEY = "nf:popular-items"
const CACHE_TTL_MS = 5 * 60 * 1000

export interface PopularItem {
  id: string
  name: string
  priceUsd: number
  emoji: string
  gradient: string
  totalQty: number
  category: string
}

interface CachedShape {
  items: PopularItem[]
  source: string
  timestamp: number
}

export function usePopularItems(): {
  items: PopularItem[]
  source: string
  loading: boolean
} {
  const [items, setItems] = useState<PopularItem[]>([])
  const [source, setSource] = useState<string>("loading")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Hydrate from cache si existe + válido
    try {
      const raw = window.localStorage.getItem(CACHE_KEY)
      if (raw) {
        const cached = JSON.parse(raw) as CachedShape
        if (
          cached &&
          Array.isArray(cached.items) &&
          Date.now() - cached.timestamp < CACHE_TTL_MS
        ) {
          setItems(cached.items)
          setSource(cached.source ?? "cache")
          setLoading(false)
          return
        }
      }
    } catch {
      // ignore corrupt cache
    }

    fetch("/api/menu/popular")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.items)) {
          setItems(data.items)
          setSource(data.source ?? "live")
          try {
            window.localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({
                items: data.items,
                source: data.source,
                timestamp: Date.now(),
              }),
            )
          } catch {
            // quota / disabled
          }
        }
      })
      .catch(() => {
        // network · keep loading=false sin items
      })
      .finally(() => setLoading(false))
  }, [])

  return { items, source, loading }
}
