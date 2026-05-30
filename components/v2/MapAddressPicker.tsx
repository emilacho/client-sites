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
    accuracy: number
  } | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const geocoderRef = useRef<GGeocoderInstance | null>(null)
  // R96.125 · last known coords · sirven cuando el cliente edita el
  // input "Dirección final" pero mantenemos la lat/lng del último
  // geocode/autocomplete/drag (el server las usa para Olón delivery
  // radius check).
  const [lastLat, setLastLat] = useState<number | null>(initial?.lat ?? null)
  const [lastLng, setLastLng] = useState<number | null>(initial?.lng ?? null)

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

    // R97.5 · multi-country autocomplete · permite que cliente piloto
     // Náufrago (Olón) + smoke test Zermatt encuentren su dirección.
     // Para nuevos clientes en otros países · sumar el ISO 2-letter code.
    const autocomplete = new g.places.Autocomplete(inputRef.current, {
      componentRestrictions: { country: ["ec", "ch"] },
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
      setLastLat(lat)
      setLastLng(lng)
      onChange({ street, lat, lng })
    })

    marker.addListener("dragend", () => {
      const pos = marker.getPosition()
      if (!pos) return
      const lat = pos.lat()
      const lng = pos.lng()
      setLastLat(lat)
      setLastLng(lng)
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
    // R96.126 · maximumAge=0 fuerza fresh fetch (sin cache) ·
    // timeout=15s da más chance al GPS de converger · accuracy se
    // captura para indicar al usuario si la posición es aproximada.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const accuracy = pos.coords.accuracy ?? 9999
        // Zoom adaptivo · 18 si <50m · 17 si <200m · 16 si <500m · 14 sino
        const zoom =
          accuracy < 50 ? 18 : accuracy < 200 ? 17 : accuracy < 500 ? 16 : 14
        const geocoder = geocoderRef.current
        if (!geocoder) {
          setDetected({ street: "", lat, lng, accuracy })
          setShowOverlay(true)
          setDetecting(false)
          return
        }
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          setDetecting(false)
          if (mapRef.current && markerRef.current) {
            mapRef.current.setCenter({ lat, lng })
            mapRef.current.setZoom(zoom)
            markerRef.current.setPosition({ lat, lng })
          }
          if (status !== "OK" || !results || results.length === 0) {
            console.warn("[MapAddressPicker] geocode no result", status)
            return
          }
          const street = results[0].formatted_address ?? ""
          if (!street || /^[\d.,\s-]+$/.test(street)) {
            console.warn("[MapAddressPicker] geocode returned non-address")
            return
          }
          setDetected({ street, lat, lng, accuracy })
          setShowOverlay(true)
        })
      },
      (err) => {
        console.warn("[MapAddressPicker] geolocation denied/failed", err)
        setDetecting(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, failed])

  function applyDetected() {
    if (!detected) return
    setStreetLocal(detected.street)
    if (inputRef.current) inputRef.current.value = detected.street
    setLastLat(detected.lat)
    setLastLng(detected.lng)
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
        onChange={(e) => {
          // R97.5 · propagar al parent SIEMPRE · antes solo se propagaba
          // post-autocomplete place_changed · si el cliente typeaba sin
          // elegir suggestion · form.street quedaba vacío y la quote
          // fallaba con validation_failed (street min(1) constraint).
          // Ahora propagamos texto plano · lat/lng se preservan si ya
          // los tenía (autocomplete previo · marker drag · geolocation).
          setStreetLocal(e.target.value)
          onChange({
            street: e.target.value,
            lat: lastLat,
            lng: lastLng,
          })
        }}
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
        {/* R96.124+126 · overlay confirmación + indicador de precisión */}
        {showOverlay && detected && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm">
            <div className="w-full max-w-[320px] rounded-lg border border-cyan-500/40 bg-slate-900 p-3 shadow-lg">
              <p className="text-[11px] uppercase tracking-widest text-cyan-300">
                ¿Esta es tu dirección actual?
              </p>
              <p className="mt-1 text-sm text-slate-100">
                {detected.street || `${detected.lat.toFixed(4)}, ${detected.lng.toFixed(4)}`}
              </p>
              {detected.accuracy > 200 && (
                <p className="mt-1 text-[10px] text-amber-300">
                  ⚠ Ubicación aproximada (±{Math.round(detected.accuracy)}m) ·
                  arrastrá el pin si está lejos
                </p>
              )}
              {detected.accuracy <= 200 && detected.accuracy > 0 && (
                <p className="mt-1 text-[10px] text-slate-500">
                  Precisión ±{Math.round(detected.accuracy)}m
                </p>
              )}
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
      {/* R96.125 · input controlled · auto-fill desde autocomplete/geocode/overlay
          · cliente edita libremente · ESTE es el campo final que viaja al server. */}
      <div>
        <label className="block text-[10px] uppercase tracking-widest text-cyan-300/80 mb-1">
          Dirección final (podés editarla)
        </label>
        <input
          type="text"
          value={streetLocal}
          onChange={(e) => {
            setStreetLocal(e.target.value)
            onChange({ street: e.target.value, lat: lastLat, lng: lastLng })
          }}
          placeholder="Calle · número · barrio"
          className="w-full rounded-md border border-cyan-500/30 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
        />
      </div>
      <p className="text-[10px] text-slate-500">
        Buscá arriba · arrastrá el pin · o editá manualmente la dirección final.
      </p>
    </div>
  )
}
