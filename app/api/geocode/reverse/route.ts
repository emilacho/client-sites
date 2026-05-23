import { NextRequest } from "next/server"

/**
 * Server-side reverse-geocoding proxy.
 *
 * Provider strategy ·
 *   1. Google Maps Geocoding API · when `GOOGLE_MAPS_API_KEY`
 *      env is set. Higher precision · paid (~$5/1K).
 *   2. Nominatim (OpenStreetMap) · free · no API key required ·
 *      rate-limited 1 req/sec per IP. Always reachable as fallback.
 *
 * Returned `short` field follows · "Barrio · Ciudad" (the topbar
 * standard). Falls back gracefully when either component missing.
 */

export const runtime = "edge"

const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ??
  "Naufrago/1.0 (https://naufrago.delivery; emilacho@hotmail.com)"
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY

interface GeocodeResult {
  short: string
  neighbourhood: string | null
  city: string | null
  country: string | null
  countryCode: string | null
  displayName: string | null
  source: "google" | "nominatim"
}

function formatShort(neighbourhood: string | null, city: string | null): string {
  if (neighbourhood && city) return `${neighbourhood} · ${city}`
  return neighbourhood ?? city ?? "Olón"
}

interface GoogleAddressComponent {
  long_name: string
  short_name: string
  types: string[]
}

interface GoogleGeocodeResult {
  address_components?: GoogleAddressComponent[]
  formatted_address?: string
}

interface GoogleGeocodeResponse {
  status: string
  results?: GoogleGeocodeResult[]
  error_message?: string
}

async function reverseGoogle(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  if (!GOOGLE_KEY) return null
  const url =
    `https://maps.googleapis.com/maps/api/geocode/json` +
    `?latlng=${lat.toFixed(5)},${lng.toFixed(5)}` +
    `&language=es&key=${GOOGLE_KEY}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) return null
  const data = (await res.json()) as GoogleGeocodeResponse
  if (data.status !== "OK" || !data.results?.length) return null

  let neighbourhood: string | null = null
  let city: string | null = null
  let country: string | null = null
  let countryCode: string | null = null

  for (const result of data.results) {
    for (const c of result.address_components ?? []) {
      const types = c.types
      if (!neighbourhood && (types.includes("neighborhood") || types.includes("sublocality_level_1") || types.includes("sublocality"))) {
        neighbourhood = c.long_name
      }
      if (!city && (types.includes("locality") || types.includes("administrative_area_level_2"))) {
        city = c.long_name
      }
      if (!country && types.includes("country")) {
        country = c.long_name
        countryCode = c.short_name.toLowerCase()
      }
    }
    if (neighbourhood && city) break
  }

  return {
    short: formatShort(neighbourhood, city),
    neighbourhood,
    city,
    country,
    countryCode,
    displayName: data.results[0]?.formatted_address ?? null,
    source: "google",
  }
}

interface NominatimAddress {
  road?: string
  pedestrian?: string
  neighbourhood?: string
  suburb?: string
  city_district?: string
  city?: string
  town?: string
  village?: string
  county?: string
  state?: string
  country?: string
  country_code?: string
}

interface NominatimResponse {
  display_name?: string
  address?: NominatimAddress
}

async function reverseNominatim(
  lat: number,
  lng: number,
): Promise<GeocodeResult | null> {
  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=jsonv2&lat=${lat.toFixed(5)}&lon=${lng.toFixed(5)}` +
    `&zoom=16&addressdetails=1&accept-language=es`
  const res = await fetch(url, {
    headers: {
      "User-Agent": NOMINATIM_UA,
      Accept: "application/json",
    },
    next: { revalidate: 300 },
  })
  if (!res.ok) return null
  const data = (await res.json()) as NominatimResponse
  const addr = data.address
  const neighbourhood =
    addr?.neighbourhood ?? addr?.suburb ?? addr?.city_district ?? null
  const city = addr?.city ?? addr?.town ?? addr?.village ?? null
  return {
    short: formatShort(neighbourhood, city),
    neighbourhood,
    city,
    country: addr?.country ?? null,
    countryCode: addr?.country_code ?? null,
    displayName: data.display_name ?? null,
    source: "nominatim",
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const lat = searchParams.get("lat")
  const lng = searchParams.get("lng")

  if (!lat || !lng) {
    return Response.json({ ok: false, error: "missing lat/lng" }, { status: 400 })
  }
  const latNum = Number(lat)
  const lngNum = Number(lng)
  if (
    !Number.isFinite(latNum) ||
    !Number.isFinite(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180
  ) {
    return Response.json({ ok: false, error: "invalid coords" }, { status: 400 })
  }

  try {
    const result =
      (await reverseGoogle(latNum, lngNum).catch(() => null)) ??
      (await reverseNominatim(latNum, lngNum).catch(() => null))

    if (!result) {
      return Response.json(
        { ok: false, error: "all providers failed" },
        { status: 502 },
      )
    }

    return new Response(
      JSON.stringify({ ok: true, ...result }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    )
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown error",
      },
      { status: 502 },
    )
  }
}
