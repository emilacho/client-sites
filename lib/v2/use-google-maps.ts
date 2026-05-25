"use client"
/**
 * useGoogleMapsScript · R96.120 · loader idempotente del JS API de
 * Google Maps + library Places. Singleton · si el script ya está
 * cargado · resuelve inmediato. Si NO hay NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ·
 * devuelve `unavailable: true` y el caller degrada a input simple.
 */
import { useEffect, useState } from "react"

declare global {
  interface Window {
    __naufragoMapsLoading?: Promise<void>
    google?: unknown
  }
}

const SCRIPT_ID = "naufrago-google-maps"

export function useGoogleMapsScript(): {
  ready: boolean
  unavailable: boolean
} {
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!key) {
      setUnavailable(true)
      return
    }
    if (typeof window === "undefined") return
    // Already loaded.
    if ((window.google as { maps?: unknown } | undefined)?.maps) {
      setReady(true)
      return
    }
    // Loading in progress · await the same promise.
    if (window.__naufragoMapsLoading) {
      window.__naufragoMapsLoading
        .then(() => setReady(true))
        .catch(() => setUnavailable(true))
      return
    }
    // First load · create the script tag.
    window.__naufragoMapsLoading = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener("load", () => resolve())
        existing.addEventListener("error", () => reject(new Error("script_error")))
        return
      }
      const script = document.createElement("script")
      script.id = SCRIPT_ID
      script.async = true
      script.defer = true
      // libraries=places para Autocomplete + PlacesService.
      // loading=async + region=EC + language=es-419 para best results LATAM.
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&loading=async&region=EC&language=es-419`
      script.onload = () => resolve()
      script.onerror = () => reject(new Error("script_error"))
      document.head.appendChild(script)
    })
    window.__naufragoMapsLoading
      .then(() => setReady(true))
      .catch(() => setUnavailable(true))
  }, [])

  return { ready, unavailable }
}
