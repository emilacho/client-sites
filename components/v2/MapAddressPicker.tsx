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

  // Mount the map + autocomplete once script is ready.
  useEffect(() => {
    if (!ready || !mapDivRef.current || !inputRef.current) return
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

    return () => {
      if (markerRef.current) markerRef.current.setMap(null)
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Fallback · sin API key · degrade al input simple.
  if (unavailable) {
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
        className="h-48 w-full overflow-hidden rounded-md border border-slate-700 bg-slate-900"
        style={{ minHeight: 192 }}
      >
        {!ready && (
          <div className="flex h-full items-center justify-center text-xs text-slate-500">
            Cargando mapa…
          </div>
        )}
      </div>
      <p className="text-[10px] text-slate-500">
        Buscá tu dirección · o arrastrá el pin en el mapa para ajustar exacto.
      </p>
    </div>
  )
}
