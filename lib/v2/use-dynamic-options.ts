"use client"
/**
 * useDynamicOptions · R96.25 · fetch + cache catálogos dinámicos.
 *
 * Cache localStorage 5min · key prefix nf:dyn-opts:<key>. Si el
 * local actualiza el catálogo en Supabase Studio · cliente nuevo
 * lo ve en <5min (o post-refresh).
 */
import { useEffect, useState } from "react"

const CACHE_PREFIX = "nf:dyn-opts:"
const CACHE_TTL_MS = 5 * 60 * 1000

export interface DynamicOption {
  id: string
  label: string
  available?: boolean
}

export interface DynamicOptionsResult {
  label: string | null
  options: DynamicOption[]
  loading: boolean
}

interface CachedShape {
  label: string | null
  options: DynamicOption[]
  timestamp: number
}

export function useDynamicOptions(key: string | null | undefined): DynamicOptionsResult {
  const [state, setState] = useState<DynamicOptionsResult>({
    label: null,
    options: [],
    loading: !!key,
  })

  useEffect(() => {
    if (!key) {
      setState({ label: null, options: [], loading: false })
      return
    }
    if (typeof window === "undefined") return

    const cacheKey = `${CACHE_PREFIX}${key}`
    try {
      const raw = window.localStorage.getItem(cacheKey)
      if (raw) {
        const parsed = JSON.parse(raw) as CachedShape
        if (
          parsed &&
          Array.isArray(parsed.options) &&
          Date.now() - parsed.timestamp < CACHE_TTL_MS
        ) {
          setState({
            label: parsed.label ?? null,
            options: parsed.options,
            loading: false,
          })
          return
        }
      }
    } catch {
      // ignore corrupt cache
    }

    fetch(`/api/dynamic-options/${encodeURIComponent(key)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.options)) {
          setState({
            label: data.label ?? null,
            options: data.options,
            loading: false,
          })
          try {
            window.localStorage.setItem(
              cacheKey,
              JSON.stringify({
                label: data.label,
                options: data.options,
                timestamp: Date.now(),
              }),
            )
          } catch {
            // quota
          }
        } else {
          setState({ label: null, options: [], loading: false })
        }
      })
      .catch(() => {
        setState({ label: null, options: [], loading: false })
      })
  }, [key])

  return state
}
