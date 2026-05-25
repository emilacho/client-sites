"use client"
/**
 * MapAddressPicker · R96.120 · Google Maps + Places Autocomplete.
 *
 * - Input con autocomplete (country=EC) · al elegir suggestion ·
 *   pinea el marker en el mapa y emite { street, lat, lng } al parent
 * - Marker draggable · usuario puede ajustar exacto · onDragEnd
 *   reverse-geocode para actualizar el street label
 * - Fallback graceful · si no hay NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ·
 *   muestra solo el input text simple
 */
import { useEffect, useRef, useState } from "react"
import { useGoogleMapsScript } from "@/lib/v2/use-google-maps"

interface Props {
  initial?: {
    street?: string
    lat?: number | null
    lng?: number | null
  }
  onChange: (data: { street: string; lat: number | null; lng: number | null }) => void
}

// Tipos minimos que uso · evito deps adicionales de @types.
interface GMapInstance {
  setCenter: (latLng: { lat: number; lng: number }) => void
  setZoom: (z: number) => void
}
interface GMarkerInstance {
  setPosition: (latLng: { lat: number; lng: number }) => void
  getPosition: () => { lat: () => number; lng: () => number } | null
  addListener: (event: string, cb: () => void) => void
  setMap: (map: GMapInstance | null) => void
}
interface GAutocompleteInstance {
  addListener: (event: string, cb: () => void) => void
  getPlace: () => {
    formatted_address?: string
    name?: string
    geometry?: {
      location?: { lat: () => number; lng: () => number }
    }
  }
}
interface GGeocoderInstance {
  geocode: (
    req: { location: { lat: number; lng: number } },
    cb: (
      results: Array<{ formatted_address?: string }> | null,
      status: string,
    ) => void,
  ) => void
}

// Olón Ecuador · centro default si no hay geo.
const OLON_CENTER = { lat: -1.795, lng: -80.756 }

export default function MapAddressPicker({ initial, onChange }: Props) {
  const { ready, unavailable } = useGoogleMapsScript()
  const inputRef = useRef<HTMLInputElement>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GMapInstance | null>(null)
  const markerRef = useRef<GMarkerInstance | null>(null)
  const [streetLocal, setStreetLocal] = useState(initial?.street ?? "")
  // R96.122 · si la inicialización del mapa throw (script timing race ·
  // referrer rechazado · billing missing) · degrade gracefully al input
  // simple sin romper el render entero.
  const [failed, setFailed] = useState(false)
  // R96.124 · auto-detect ubicación · al abrir el picker · si el browser
  // permite geolocation · centrar mapa ahí + reverse geocode + mostrar
  // overlay "¿Esta es tu dirección actual?" con Sí/No.
  const [detected, setDetected] = useState<{
    street: string
    lat: number
    lng: number
  } | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const geocoderRef = useRef<GGeocoderInstance | null>(null)

  // Mount the map + autocomplete once script is ready.
  useEffect(() => {
    if (!ready || !mapDivRef.current || !inputRef.current) return
    let cleanup: (() => void) | undefined
    try {
    const w = window as unknown as {
      google: {
        maps: {
          Map: new (
            el: HTMLElement,
            opts: {
              center: { lat: number; lng: number }
              zoom: number
              disableDefaultUI?: boolean
              mapTypeControl?: boolean
              streetViewControl?: boolean
              fullscreenControl?: boolean
              zoomControl?: boolean
              styles?: unknown
            },
          ) => GMapInstance
          Marker: new (opts: {
            position: { lat: number; lng: number }
            map: GMapInstance
            draggable?: boolean
          }) => GMarkerInstance
          Geocoder: new () => GGeocoderInstance
          places: {
            Autocomplete: new (
              input: HTMLInputElement,
              opts: {
                componentRestrictions?: { country: string | string[] }
                fields?: string[]
                types?: string[]
              },
            ) => GAutocompleteInstance
          }
        }
      }
    }
    const g = w.google.maps
    const startLat =
      typeof initial?.lat === "number" ? initial.lat : OLON_CENTER.lat
    const startLng =
      typeof initial?.lng === "number" ? initial.lng : OLON_CENTER.lng

    const map = new g.Map(mapDivRef.current, {
      center: { lat: startLat, lng: startLng },
      zoom: initial?.lat ? 16 : 13,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    })
    mapRef.current = map

    const marker = new g.Marker({
      position: { lat: startLat, lng: startLng },
      map,
      draggable: true,
    })
    markerRef.current = marker

    const geocoder = new g.Geocoder()
    geocoderRef.current = geocoder

    const autocomplete = new g.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "ec" },
      fields: ["formatted_address", "geometry", "name"],
      types: ["geocode", "establishment"],
    })

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace()
      const loc = place.geometry?.location
      if (!loc) return
      const lat = loc.lat()
      const lng = loc.lng()
      map.setCenter({ lat, lng })
      map.setZoom(17)
      marker.setPosition({ lat, lng })
      const street = place.formatted_address ?? place.name ?? ""
      setStreetLocal(street)
      onChange({ street, lat, lng })
    })

    marker.addListener("dragend", () => {
      const pos = marker.getPosition()
      if (!pos) return
      const lat = pos.lat()
      const lng = pos.lng()
      // Reverse geocode para actualizar el street.
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results.length > 0) {
          const street = results[0].formatted_address ?? ""
          setStreetLocal(street)
          if (inputRef.current) inputRef.current.value = street
          onChange({ street, lat, lng })
        } else {
          onChange({ street: streetLocal, lat, lng })
        }
      })
    })

    cleanup = () => {
      try {
        if (markerRef.current) markerRef.current.setMap(null)
      } catch (err) {
        console.error("[MapAddressPicker] cleanup error", err)
      }
      mapRef.current = null
      markerRef.current = null
    }
    } catch (err) {
      console.error("[MapAddressPicker] init error", err)
      setFailed(true)
    }
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // R96.124 · auto-detect ubicación al primer mount · solo si no hay
  // initial.lat (no es edición de address existente). Browser pide
  // permiso · si OK · reverse geocode + overlay con "Sí/No".
  useEffect(() => {
    if (!ready || failed || initial?.lat) return
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const geocoder = geocoderRef.current
        if (!geocoder) {
          setDetected({ street: "", lat, lng })
          setShowOverlay(true)
          setDetecting(false)
          return
        }
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          const street =
            status === "OK" && results && results.length > 0
              ? (results[0].formatted_address ?? "")
              : `${lat.toFixed(5)}, ${lng.toFixed(5)}`
          setDetected({ street, lat, lng })
          setShowOverlay(true)
          setDetecting(false)
          // Centrar el mapa en la ubicación detectada
          if (mapRef.current && markerRef.current) {
            mapRef.current.setCenter({ lat, lng })
            mapRef.current.setZoom(17)
            markerRef.current.setPosition({ lat, lng })
          }
        })
      },
      (err) => {
        console.warn("[MapAddressPicker] geolocation denied/failed", err)
        setDetecting(false)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, failed])

  function applyDetected() {
    if (!detected) return
    setStreetLocal(detected.street)
    if (inputRef.current) inputRef.current.value = detected.street
    onChange({ street: detected.street, lat: detected.lat, lng: detected.lng })
    setShowOverlay(false)
  }

  function rejectDetected() {
    setShowOverlay(false)
    // Mantiene el mapa donde quedó pero NO escribe nada al parent ·
    // usuario busca manual o draggea el pin.
  }

  // Fallback · sin API key o init falló · degrade al input simple.
  if (unavailable || failed) {
    return (
      <input
        type="text"
        value={streetLocal}
        onChange={(e) => {
          setStreetLocal(e.target.value)
          onChange({ street: e.target.value, lat: null, lng: null })
        }}
        placeholder="Calle · número · barrio"
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
      />
    )
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="text"
        defaultValue={streetLocal}
        onChange={(e) => setStreetLocal(e.target.value)}
        placeholder="Buscá tu dirección…"
        className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        autoComplete="off"
      />
      <div
        ref={mapDivRef}
        className="relative h-48 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900"
        style={{ minHeight: 192 }}
      >
        {!ready && (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Cargando mapa…
          </div>
        )}
        {detecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
            <p className="text-xs text-cyan-300">Detectando tu ubicación…</p>
          </div>
        )}
        {/* R96.124 · overlay confirmación post-geolocation · "¿Es tu dirección actual?" */}
        {showOverlay && detected && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm">
            <div className="w-full max-w-[300px] rounded-lg border border-cyan-500/40 bg-slate-900 p-3 shadow-lg">
              <p className="text-[11px] uppercase tracking-widest text-cyan-300">
                ¿Esta es tu dirección actual?
              </p>
              <p className="mt-1 text-sm text-slate-100">
                {detected.street || `${detected.lat.toFixed(4)}, ${detected.lng.toFixed(4)}`}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={rejectDetected}
                  className="flex-1 rounded-md border border-slate-700 px-2 py-1.5 text-[11px] text-slate-300 hover:bg-slate-800"
                >
                  No · cambiar
                </button>
                <button
                  type="button"
                  onClick={applyDetected}
                  className="flex-1 rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-2 py-1.5 text-[11px] font-semibold text-white"
                >
                  Sí · aplicar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-500">
        Buscá tu dirección · o arrastrá el pin en el mapa para ajustar exacto.
      </p>
    </div>
  )
}
