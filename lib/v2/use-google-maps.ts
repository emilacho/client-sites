"use client"
/**
 * useGoogleMapsScript · cargador del mapa de Google.
 *
 * R138 · pasa al modo MODERNO (`loading=async` + `importLibrary`).
 *
 * Antes (R96.123) se cargaba a la vieja usanza, con `libraries=places` en
 * la dirección y sin `loading=async`, porque el buscador de direcciones
 * usaba la clase antigua `google.maps.places.Autocomplete` y ese modo la
 * rompía. Ese buscador ya no existe para proyectos nuevos desde marzo de
 * 2025 · el nuestro seguía andando sólo porque la cuenta es vieja, y el
 * día que Google lo apague se cae el cálculo del envío entero.
 *
 * Ahora el buscador usa la API nueva, así que este cargador puede usar el
 * modo que Google recomienda: se pide el script una vez y cada parte del
 * mapa se trae cuando hace falta con `google.maps.importLibrary(...)`.
 *
 * Si no hay llave configurada · `unavailable: true` y quien lo llama
 * degrada a un campo de texto simple.
 */
import { useEffect, useState } from "react"

declare global {
  interface Window {
    __naufragoMapsLoading?: Promise<void>
    google?: unknown
  }
}

const SCRIPT_ID = "naufrago-google-maps"
/** Google llama a esta función cuando el mapa YA está listo de verdad. */
const NOMBRE_AVISO = "__naufragoMapsListo"

/** ¿El script ya dejó lista la puerta de entrada moderna? */
function tieneImportLibrary(): boolean {
  const g = (window.google as { maps?: { importLibrary?: unknown } } | undefined)?.maps
  return typeof g?.importLibrary === "function"
}

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
    if (tieneImportLibrary()) {
      setReady(true)
      return
    }
    if (window.__naufragoMapsLoading) {
      window.__naufragoMapsLoading
        .then(() => setReady(true))
        .catch(() => setUnavailable(true))
      return
    }
    window.__naufragoMapsLoading = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null
      if (existing) {
        existing.addEventListener("load", () => resolve())
        existing.addEventListener("error", () => reject(new Error("script_error")))
        return
      }
      // OJO · con `loading=async` el `onload` del script NO alcanza: el
      // API termina de armarse DESPUÉS, y ahí recién existe
      // `importLibrary`. Sin este aviso de vuelta, el mapa falla con
      // "importLibrary is not a function". Lo vi en la primera prueba.
      const w = window as unknown as Record<string, unknown>
      w[NOMBRE_AVISO] = () => resolve()
      const script = document.createElement("script")
      script.id = SCRIPT_ID
      script.async = true
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&v=weekly&region=EC&language=es-419&callback=${NOMBRE_AVISO}`
      script.onerror = () => reject(new Error("script_error"))
      document.head.appendChild(script)
    })
    window.__naufragoMapsLoading
      .then(() => setReady(true))
      .catch(() => setUnavailable(true))
  }, [])

  return { ready, unavailable }
}
