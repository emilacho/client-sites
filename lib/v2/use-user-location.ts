"use client"
import { useEffect, useState } from "react"

/**
 * Browser geolocation + reverse-geocode hook.
 *
 * Lifecycle ·
 *   idle      → mount · before permission prompt fires
 *   asking    → prompt visible · waiting on user
 *   loading   → coords obtained · geocoding API in-flight
 *   ready     → label resolved · safe to render
 *   denied    → user denied permission · UI should fall back to brand
 *   unsupported → no navigator.geolocation
 *   error     → coords ok but geocode failed (network · 502 · etc)
 *
 * Cache · localStorage `nf:user-location` · 5 minutes · so SPA
 * route transitions and reloads don't re-prompt or re-bill the
 * Nominatim proxy.
 */

export type LocationState =
  | "idle"
  | "asking"
  | "loading"
  | "ready"
  | "denied"
  | "unsupported"
  | "error"

interface CachedLocation {
  label: string
  timestamp: number
}

interface Result {
  state: LocationState
  label: string | null
}

const CACHE_KEY = "nf:user-location"
const CACHE_TTL_MS = 5 * 60 * 1000

function readCache(): CachedLocation | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedLocation
    if (
      typeof parsed.label !== "string" ||
      typeof parsed.timestamp !== "number"
    ) {
      return null
    }
    if (Date.now() - parsed.timestamp > CACHE_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

function writeCache(label: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ label, timestamp: Date.now() } satisfies CachedLocation),
    )
  } catch {
    // localStorage quota or disabled · silently skip
  }
}

export function useUserLocation(): Result {
  const [state, setState] = useState<LocationState>("idle")
  const [label, setLabel] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return

    const cached = readCache()
    if (cached) {
      setLabel(cached.label)
      setState("ready")
      return
    }

    if (!("geolocation" in navigator)) {
      setState("unsupported")
      return
    }

    setState("asking")
    let cancelled = false
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (cancelled) return
        setState("loading")
        try {
          const res = await fetch(
            `/api/geocode/reverse?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`,
            { cache: "no-store" },
          )
          if (!res.ok) throw new Error(`geocode ${res.status}`)
          const data = (await res.json()) as {
            ok: boolean
            short?: string
          }
          if (cancelled) return
          if (!data.ok || !data.short) throw new Error("empty geocode")
          setLabel(data.short)
          setState("ready")
          writeCache(data.short)
        } catch {
          if (!cancelled) setState("error")
        }
      },
      (err) => {
        if (cancelled) return
        if (err.code === err.PERMISSION_DENIED) setState("denied")
        else setState("error")
      },
      {
        // Objetivo · dirección EXACTA (calle + número). HighAccuracy
        // activa GPS hardware en móvil · battery cost OK · UX
        // requirement gana sobre power saving.
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 2 * 60 * 1000,
      },
    )

    return () => {
      cancelled = true
    }
  }, [])

  return { state, label }
}
