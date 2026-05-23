import { NextRequest } from "next/server"

/**
 * Server-side reverse-geocoding proxy.
 *
 * Hits OpenStreetMap Nominatim (free · no API key · rate-limited
 * 1 req/sec per IP). We proxy from the server so we can attach the
 * required User-Agent header (Nominatim ToS) and so the browser
 * never sees the raw OSM response · just a tight schema useful for
 * the topbar.
 *
 * Cache · Cache-Control public 5min · keyed by lat/lng rounded to
 * 4 decimals (~11m precision) · prevents per-keystroke flood.
 */

export const runtime = "edge"

const NOMINATIM_UA =
  process.env.NOMINATIM_USER_AGENT ??
  "Naufrago/1.0 (https://naufrago.delivery; emilacho@hotmail.com)"

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

function pickShort(addr: NominatimAddress | undefined): string {
  if (!addr) return "Olón"
  const street = addr.road ?? addr.pedestrian
  const area =
    addr.neighbourhood ??
    addr.suburb ??
    addr.city_district ??
    addr.city ??
    addr.town ??
    addr.village
  if (street && area) return `${street} · ${area}`
  return street ?? area ?? "Olón"
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

  const url =
    `https://nominatim.openstreetmap.org/reverse` +
    `?format=jsonv2&lat=${latNum.toFixed(5)}&lon=${lngNum.toFixed(5)}` +
    `&zoom=18&addressdetails=1&accept-language=es`

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": NOMINATIM_UA,
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    })
    if (!res.ok) {
      return Response.json(
        { ok: false, error: `nominatim ${res.status}` },
        { status: 502 },
      )
    }
    const data = (await res.json()) as NominatimResponse
    const addr = data.address
    return new Response(
      JSON.stringify({
        ok: true,
        short: pickShort(addr),
        street: addr?.road ?? addr?.pedestrian ?? null,
        neighbourhood:
          addr?.neighbourhood ?? addr?.suburb ?? addr?.city_district ?? null,
        city: addr?.city ?? addr?.town ?? addr?.village ?? null,
        country: addr?.country ?? null,
        countryCode: addr?.country_code ?? null,
        displayName: data.display_name ?? null,
      }),
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
