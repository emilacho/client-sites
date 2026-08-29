"use client"
/**
 * MapAddressPicker · buscador de dirección + mapa con pin arrastrable.
 *
 * R138 · MIGRADO A LA API NUEVA DE LUGARES.
 *
 * Por qué se tocó algo que funcionaba: el buscador usaba
 * `google.maps.places.Autocomplete`, que Google no le da a proyectos
 * nuevos desde marzo de 2025. El nuestro seguía andando sólo porque la
 * cuenta es vieja. El día que lo apaguen se cae la búsqueda de dirección,
 * y sin dirección exacta PedidosYa no cotiza: se cae la venta. Ya vimos el
 * 29-ago cómo se siente eso, cuando la llave tenía bloqueado naufrago.ec.
 *
 * QUÉ SE ELIGIÓ Y POR QUÉ
 * Google ofrece dos caminos para reemplazarlo. Uno es su componente
 * `PlaceAutocompleteElement`, que trae su propio campo de texto y su
 * propia lista: se instala en dos líneas, pero viene con su look y este
 * carrito es oscuro y muy cuidado. El otro es pedirle las sugerencias a
 * `AutocompleteSuggestion` y dibujarlas nosotros. Se eligió el segundo:
 * mismo campo de siempre, misma lista con nuestros colores, y encima
 * control del cobro (ver sesión, abajo).
 *
 * LA SESIÓN NO ES UN DETALLE
 * Google cobra el buscador por SESIÓN, no por tecla: todas las teclas que
 * escribe el cliente más el lugar que elige cuentan como una sola
 * búsqueda, si van con la misma ficha de sesión. Por eso se crea una
 * ficha al empezar a escribir y se tira apenas elige. Sin esto, cada
 * tecla se cobraría por separado.
 *
 * EL PIN SIGUE SIENDO EL CLÁSICO
 * Google también recomienda `AdvancedMarkerElement` en vez de `Marker`.
 * Ese pin exige crear un "Map ID" en la consola de Google, que es un
 * trámite aparte en la cuenta de Emilio. `Marker` está marcado como viejo
 * pero NO tiene fecha de apagado anunciada, así que se deja para cuando
 * exista ese identificador. Queda anotado, no olvidado.
 *
 * Si no hay llave o algo falla al armar el mapa · degrada a un campo de
 * texto simple sin romper el carrito.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { COCINA } from "@/lib/ubicacion"
import { useGoogleMapsScript } from "@/lib/v2/use-google-maps"

interface Props {
  initial?: {
    street?: string
    lat?: number | null
    lng?: number | null
  }
  onChange: (data: { street: string; lat: number | null; lng: number | null }) => void
}

// ── Tipos mínimos · evito sumar dependencias de @types sólo para esto ──
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
interface GGeocoderInstance {
  geocode: (req: {
    location: { lat: number; lng: number }
  }) => Promise<{ results: Array<{ formatted_address?: string }> }>
}
/** Un lugar de la API nueva · se piden los campos que se van a usar. */
interface GPlace {
  fetchFields: (req: { fields: string[] }) => Promise<unknown>
  formattedAddress?: string | null
  displayName?: string | null
  location?: { lat: () => number; lng: () => number } | null
}
interface GPrediction {
  text?: { text?: string }
  mainText?: { text?: string }
  secondaryText?: { text?: string }
  toPlace: () => GPlace
}

interface Sugerencia {
  titulo: string
  detalle: string
  prediccion: GPrediction
}

// R105 · el mapa abre en la cocina que despacha. Antes abría en Olón, a
// 103 km: un cliente de Guayaquil veía el mapa en otra provincia.
const CENTRO_MAPA = { lat: COCINA.lat, lng: COCINA.lng }

export default function MapAddressPicker({ initial, onChange }: Props) {
  const { ready, unavailable } = useGoogleMapsScript()
  const inputRef = useRef<HTMLInputElement>(null)
  const mapDivRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<GMapInstance | null>(null)
  const markerRef = useRef<GMarkerInstance | null>(null)
  const geocoderRef = useRef<GGeocoderInstance | null>(null)
  // Puerta de entrada a la API nueva de lugares + la ficha de sesión.
  const placesRef = useRef<{
    AutocompleteSuggestion: {
      fetchAutocompleteSuggestions: (req: Record<string, unknown>) => Promise<{
        suggestions: Array<{ placePrediction?: GPrediction }>
      }>
    }
    AutocompleteSessionToken: new () => object
  } | null>(null)
  const sesionRef = useRef<object | null>(null)

  const [streetLocal, setStreetLocal] = useState(initial?.street ?? "")
  const [failed, setFailed] = useState(false)
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([])
  const [buscando, setBuscando] = useState(false)
  const [detected, setDetected] = useState<{
    street: string
    lat: number
    lng: number
    accuracy: number
  } | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [showOverlay, setShowOverlay] = useState(false)
  const [lastLat, setLastLat] = useState<number | null>(initial?.lat ?? null)
  const [lastLng, setLastLng] = useState<number | null>(initial?.lng ?? null)

  // ── Armar el mapa una vez que el script está listo ──────────────────
  useEffect(() => {
    if (!ready || !mapDivRef.current) return
    let vivo = true
    const armar = async () => {
      try {
        const g = (window.google as {
          maps: { importLibrary: (n: string) => Promise<unknown> }
        }).maps
        const [libMapa, libPin, libLugares, libGeo] = await Promise.all([
          g.importLibrary("maps"),
          g.importLibrary("marker"),
          g.importLibrary("places"),
          g.importLibrary("geocoding"),
        ])
        if (!vivo || !mapDivRef.current) return

        const { Map } = libMapa as {
          Map: new (el: HTMLElement, opts: Record<string, unknown>) => GMapInstance
        }
        const { Marker } = libPin as {
          Marker: new (opts: Record<string, unknown>) => GMarkerInstance
        }
        const { Geocoder } = libGeo as { Geocoder: new () => GGeocoderInstance }
        placesRef.current = libLugares as typeof placesRef.current

        const startLat = typeof initial?.lat === "number" ? initial.lat : CENTRO_MAPA.lat
        const startLng = typeof initial?.lng === "number" ? initial.lng : CENTRO_MAPA.lng

        const map = new Map(mapDivRef.current, {
          center: { lat: startLat, lng: startLng },
          zoom: initial?.lat ? 16 : 13,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        mapRef.current = map

        const marker = new Marker({
          position: { lat: startLat, lng: startLng },
          map,
          draggable: true,
        })
        markerRef.current = marker
        geocoderRef.current = new Geocoder()

        marker.addListener("dragend", async () => {
          const pos = marker.getPosition()
          if (!pos) return
          const lat = pos.lat()
          const lng = pos.lng()
          setLastLat(lat)
          setLastLng(lng)
          try {
            const { results } = await geocoderRef.current!.geocode({
              location: { lat, lng },
            })
            const street = results?.[0]?.formatted_address ?? ""
            if (street) {
              setStreetLocal(street)
              if (inputRef.current) inputRef.current.value = street
              onChange({ street, lat, lng })
              return
            }
          } catch {
            // Sin nombre de calle el punto igual sirve · es lo que cotiza.
          }
          onChange({ street: streetLocal, lat, lng })
        })
      } catch (err) {
        console.error("[MapAddressPicker] error al armar el mapa", err)
        if (vivo) setFailed(true)
      }
    }
    armar()
    return () => {
      vivo = false
      try {
        if (markerRef.current) markerRef.current.setMap(null)
      } catch (err) {
        console.error("[MapAddressPicker] error al desarmar", err)
      }
      mapRef.current = null
      markerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // ── Sugerencias · API nueva, lista dibujada por nosotros ────────────
  const pedirSugerencias = useCallback(async (texto: string) => {
    const lugares = placesRef.current
    if (!lugares || texto.trim().length < 3) {
      setSugerencias([])
      return
    }
    if (!sesionRef.current) {
      sesionRef.current = new lugares.AutocompleteSessionToken()
    }
    setBuscando(true)
    try {
      const { suggestions } = await lugares.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: texto,
        // R97.5 · cliente piloto en Ecuador + pruebas en Suiza.
        includedRegionCodes: ["ec", "ch"],
        language: "es-419",
        region: "ec",
        sessionToken: sesionRef.current,
      })
      setSugerencias(
        (suggestions ?? [])
          .map((s) => s.placePrediction)
          .filter((p): p is GPrediction => Boolean(p))
          .slice(0, 5)
          .map((p) => ({
            titulo: p.mainText?.text ?? p.text?.text ?? "",
            detalle: p.secondaryText?.text ?? "",
            prediccion: p,
          })),
      )
    } catch (err) {
      console.warn("[MapAddressPicker] no se pudieron traer sugerencias", err)
      setSugerencias([])
    } finally {
      setBuscando(false)
    }
  }, [])

  async function elegirSugerencia(s: Sugerencia) {
    setSugerencias([])
    try {
      const place = s.prediccion.toPlace()
      await place.fetchFields({ fields: ["formattedAddress", "displayName", "location"] })
      const loc = place.location
      const street = place.formattedAddress ?? place.displayName ?? s.titulo
      setStreetLocal(street)
      if (inputRef.current) inputRef.current.value = street
      if (loc) {
        const lat = loc.lat()
        const lng = loc.lng()
        mapRef.current?.setCenter({ lat, lng })
        mapRef.current?.setZoom(17)
        markerRef.current?.setPosition({ lat, lng })
        setLastLat(lat)
        setLastLng(lng)
        onChange({ street, lat, lng })
      } else {
        onChange({ street, lat: lastLat, lng: lastLng })
      }
    } catch (err) {
      console.warn("[MapAddressPicker] no se pudo leer el lugar elegido", err)
    } finally {
      // La sesión se cierra al elegir · la próxima búsqueda abre otra.
      sesionRef.current = null
    }
  }

  // ── Detectar la ubicación al abrir · igual que antes ────────────────
  useEffect(() => {
    if (!ready || failed || initial?.lat) return
    if (typeof navigator === "undefined" || !navigator.geolocation) return
    setDetecting(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const accuracy = pos.coords.accuracy ?? 9999
        const zoom = accuracy < 50 ? 18 : accuracy < 200 ? 17 : accuracy < 500 ? 16 : 14
        if (mapRef.current && markerRef.current) {
          mapRef.current.setCenter({ lat, lng })
          mapRef.current.setZoom(zoom)
          markerRef.current.setPosition({ lat, lng })
        }
        const geocoder = geocoderRef.current
        if (!geocoder) {
          setDetected({ street: "", lat, lng, accuracy })
          setShowOverlay(true)
          setDetecting(false)
          return
        }
        try {
          const { results } = await geocoder.geocode({ location: { lat, lng } })
          const street = results?.[0]?.formatted_address ?? ""
          if (street && !/^[\d.,\s-]+$/.test(street)) {
            setDetected({ street, lat, lng, accuracy })
            setShowOverlay(true)
          }
        } catch (err) {
          console.warn("[MapAddressPicker] no se pudo nombrar la ubicación", err)
          setDetected({ street: "", lat, lng, accuracy })
          setShowOverlay(true)
        } finally {
          setDetecting(false)
        }
      },
      (err) => {
        console.warn("[MapAddressPicker] ubicación negada o fallida", err)
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
  }

  // Sin llave o con el mapa caído · campo de texto simple.
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
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          defaultValue={streetLocal}
          onChange={(e) => {
            const v = e.target.value
            // R97.5 · el texto viaja SIEMPRE al carrito · si el cliente
            // escribe sin elegir de la lista, la dirección no puede
            // quedar vacía. Las coordenadas se conservan si ya las había.
            setStreetLocal(v)
            onChange({ street: v, lat: lastLat, lng: lastLng })
            pedirSugerencias(v)
          }}
          onBlur={() => {
            // Se espera un toque para no matar el click en la lista.
            setTimeout(() => setSugerencias([]), 180)
          }}
          placeholder="Buscá tu dirección…"
          className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
          autoComplete="off"
        />
        {buscando && sugerencias.length === 0 ? (
          <span className="absolute right-3 top-2.5 text-[10px] text-slate-500">
            buscando…
          </span>
        ) : null}
        {sugerencias.length > 0 ? (
          <ul
            data-sugerencias="direccion"
            className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-cyan-500/30 bg-slate-950 shadow-xl"
          >
            {sugerencias.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => elegirSugerencia(s)}
                  className="block w-full px-3 py-2 text-left hover:bg-slate-800"
                >
                  <span className="block text-sm text-slate-100">{s.titulo}</span>
                  {s.detalle ? (
                    <span className="block text-[11px] text-slate-500">{s.detalle}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

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

      <div>
        <label className="block text-[10px] uppercase tracking-widest text-cyan-300/80 mb-1">
          Dirección final (puedes editarla)
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
