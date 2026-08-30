import "server-only"
/**
 * PedidosYa Courier API · CourierProvider implementation.
 *
 * R99 · rewritten against the REAL PedidosYa Envíos/Courier API
 * after the OpenAPI spec extraction + a live smoke (token v1 +
 * estimate isTest, both HTTP 200, 2026-07-13). Every endpoint
 * path, field name, and response shape below is verified against
 * production — no more scaffold guesses.
 *
 * ── Auth (API v1 · password grant) ──────────────────────────────
 *   POST {AUTH_URL}/v1/token
 *     Content-Type: application/json
 *     { client_id, client_secret, grant_type:"password",
 *       username (= email), password }
 *     → 200 { access_token, refresh_token }   · token dura 45 min
 *   Todas las llamadas posteriores mandan el token CRUDO:
 *     Authorization: <access_token>            (SIN prefijo "Bearer")
 *   PedidosYa BLOQUEA 10 min si se piden tokens de más → el token se
 *   cachea compartido en Supabase (naufrago.courier_token_cache) para
 *   que todas las instancias serverless reusen uno solo.
 *
 * ── Shipping endpoints (API v3 · base COURIER_URL) ──────────────
 *   POST /v3/shippings/estimates                     · getQuote
 *   POST /v3/shippings                               · dispatch (1-paso)
 *   GET  /v3/shippings/{shippingId}                  · getStatus
 *   GET  /v3/shippings/{shippingId}/tracking         · rider live pos
 *   POST /v3/shippings/{shippingId}/cancel           · cancel
 *
 * ── Sandbox ─────────────────────────────────────────────────────
 *   NO hay host separado de pruebas. Se testea contra producción
 *   mandando "isTest": true en el body (órdenes sin rider real).
 *   Controlado por env PEDIDOSYA_COURIER_IS_TEST=true.
 *
 * ── Env vars (server-only) ──────────────────────────────────────
 *   PEDIDOSYA_COURIER_CLIENT_ID
 *   PEDIDOSYA_COURIER_CLIENT_SECRET
 *   PEDIDOSYA_COURIER_USERNAME          · email de la cuenta courier
 *   PEDIDOSYA_COURIER_PASSWORD
 *   PEDIDOSYA_COURIER_AUTH_URL          · default https://auth-api.pedidosya.com
 *   PEDIDOSYA_COURIER_BASE_URL          · default https://courier-api.pedidosya.com
 *   PEDIDOSYA_COURIER_PICKUP_ADDRESS    · calle de la cocina
 *   PEDIDOSYA_COURIER_PICKUP_CITY       · default "Guayaquil"
 *   PEDIDOSYA_COURIER_PICKUP_LAT / _LNG · coords decimales del pickup
 *   PEDIDOSYA_COURIER_PICKUP_PHONE      · E.164 · contacto del local
 *   PEDIDOSYA_COURIER_PICKUP_NAME       · default "Náufrago"
 *   PEDIDOSYA_COURIER_DROPOFF_CITY      · default "Guayaquil"
 *   PEDIDOSYA_COURIER_WEBHOOK_KEY       · clave estática del callback
 *   PEDIDOSYA_COURIER_IS_TEST           · "true" fuerza isTest en todo
 *   PEDIDOSYA_COURIER_ITEM_WEIGHT_KG    · default 0.5 (peso por unidad)
 *   PEDIDOSYA_COURIER_ITEM_VOLUME       · default 1   (volumen por unidad)
 */
import { timingSafeEqual } from "node:crypto"
import type { NaufragoOrderStatus } from "@/lib/schemas"
import { getSupabaseAdmin } from "@/lib/supabase"
import {
  CourierEnvError,
  CourierShapeError,
  type Address,
  type CourierProvider,
  type DispatchParams,
  type DispatchResult,
  type QuoteParams,
  type QuoteResult,
  type RiderInfo,
  type StatusSnapshot,
  type WebhookEvent,
} from "./provider"

const PROVIDER_ID = "PEDIDOSYA_COURIER" as const

/* ─── Env helpers ───────────────────────────────────────────── */

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new CourierEnvError(name)
  return v
}

function envOptional(name: string): string | undefined {
  return process.env[name] || undefined
}

function getAuthUrl(): string {
  return envOptional("PEDIDOSYA_COURIER_AUTH_URL") ?? "https://auth-api.pedidosya.com"
}

function getBaseUrl(): string {
  return envOptional("PEDIDOSYA_COURIER_BASE_URL") ?? "https://courier-api.pedidosya.com"
}

function isTestMode(): boolean {
  return process.env.PEDIDOSYA_COURIER_IS_TEST === "true"
}

interface PickupWaypoint {
  addressStreet: string
  city: string
  latitude: number
  longitude: number
  phone: string
  name: string
}

function getPickup(): PickupWaypoint {
  return {
    addressStreet: requireEnv("PEDIDOSYA_COURIER_PICKUP_ADDRESS"),
    city: envOptional("PEDIDOSYA_COURIER_PICKUP_CITY") ?? "Guayaquil",
    latitude: Number(requireEnv("PEDIDOSYA_COURIER_PICKUP_LAT")),
    longitude: Number(requireEnv("PEDIDOSYA_COURIER_PICKUP_LNG")),
    phone: requireEnv("PEDIDOSYA_COURIER_PICKUP_PHONE"),
    name: envOptional("PEDIDOSYA_COURIER_PICKUP_NAME") ?? "Náufrago",
  }
}

function dropoffCity(): string {
  return envOptional("PEDIDOSYA_COURIER_DROPOFF_CITY") ?? "Guayaquil"
}

function itemDefaults(): { weight: number; volume: number } {
  return {
    weight: Number(process.env.PEDIDOSYA_COURIER_ITEM_WEIGHT_KG ?? "0.5"),
    volume: Number(process.env.PEDIDOSYA_COURIER_ITEM_VOLUME ?? "1"),
  }
}

/* ─── Token · v1 password grant + Supabase shared cache ─────────
 *
 * L1 = módulo (misma instancia serverless caliente).
 * L2 = Supabase naufrago.courier_token_cache (cross-instancia).
 * Se re-usa el token hasta 2 min antes de expirar. Si Supabase no
 * está disponible (tabla sin migrar aún, etc.) cae a L1-only sin
 * romper — el peor caso es pedir token por cold-start, nunca un
 * crash. */

interface TokenEntry {
  token: string
  expiresAt: number // ms epoch
}
let memToken: TokenEntry | null = null
const MARGIN_MS = 2 * 60_000
const TOKEN_TTL_MS = 45 * 60_000 // doc · "The token has 45 minutes duration"

function tokenStillGood(e: TokenEntry | null): e is TokenEntry {
  return !!e && e.expiresAt > Date.now() + MARGIN_MS
}

async function readCachedToken(): Promise<TokenEntry | null> {
  if (tokenStillGood(memToken)) return memToken
  try {
    const supabase = getSupabaseAdmin()
    const { data } = await supabase
      .from("courier_token_cache")
      .select("access_token, expires_at")
      .eq("provider", PROVIDER_ID)
      .maybeSingle()
    if (data?.access_token && data.expires_at) {
      const entry: TokenEntry = {
        token: data.access_token,
        expiresAt: new Date(data.expires_at).getTime(),
      }
      if (tokenStillGood(entry)) {
        memToken = entry
        return entry
      }
    }
  } catch {
    // Supabase inaccesible · seguimos con fetch de token nuevo.
  }
  return null
}

async function persistToken(
  accessToken: string,
  refreshToken: string | undefined,
  expiresAt: number,
): Promise<void> {
  memToken = { token: accessToken, expiresAt }
  try {
    const supabase = getSupabaseAdmin()
    await supabase.from("courier_token_cache").upsert(
      {
        provider: PROVIDER_ID,
        access_token: accessToken,
        refresh_token: refreshToken ?? null,
        expires_at: new Date(expiresAt).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider" },
    )
  } catch {
    // best-effort · L1 sigue sirviendo esta instancia.
  }
}

async function fetchFreshToken(): Promise<TokenEntry> {
  const url = `${getAuthUrl()}/v1/token`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requireEnv("PEDIDOSYA_COURIER_CLIENT_ID"),
      client_secret: requireEnv("PEDIDOSYA_COURIER_CLIENT_SECRET"),
      grant_type: "password",
      username: requireEnv("PEDIDOSYA_COURIER_USERNAME"),
      password: requireEnv("PEDIDOSYA_COURIER_PASSWORD"),
    }),
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new CourierShapeError(`token_${res.status}:${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    access_token?: string
    refresh_token?: string
  }
  if (!json.access_token)
    throw new CourierShapeError("token_missing_access_token")
  const expiresAt = Date.now() + TOKEN_TTL_MS
  await persistToken(json.access_token, json.refresh_token, expiresAt)
  return { token: json.access_token, expiresAt }
}

async function getAccessToken(): Promise<string> {
  const cached = await readCachedToken()
  if (cached) return cached.token
  return (await fetchFreshToken()).token
}

async function authedFetch(
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<Response> {
  const token = await getAccessToken()
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      // PedidosYa · token CRUDO en Authorization (sin "Bearer").
      Authorization: token,
    },
    body: init.body,
    cache: "no-store",
  })
  // 401 · token vencido/inválido → una re-auth forzada + retry.
  if (res.status === 401) {
    memToken = null
    const fresh = await fetchFreshToken()
    return fetch(`${getBaseUrl()}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: fresh.token,
      },
      body: init.body,
      cache: "no-store",
    })
  }
  return res
}

/* ─── Status mapping · PedidosYa ShippingStatus → nuestro enum ── */

function mapProviderStatus(provider: string): NaufragoOrderStatus | null {
  switch (provider.toUpperCase()) {
    case "CONFIRMED":
      return "ACCEPTED"
    case "IN_PROGRESS":
    case "NEAR_PICKUP":
      return "READY"
    case "PICKED_UP":
      return "RIDER_PICKED_UP"
    case "NEAR_DROPOFF":
      return "IN_TRANSIT"
    case "COMPLETED":
      return "DELIVERED"
    case "REJECTED":
    case "CANCELLED":
      return "CANCELLED"
    default:
      return null
  }
}

/* ─── Type helpers ──────────────────────────────────────────── */

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined
}
function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined
}

/** minutos desde ahora hasta un ISO date-time futuro · o undefined. */
function minutesUntil(iso: string | undefined): number | undefined {
  if (!iso) return undefined
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return undefined
  return Math.max(0, Math.round((t - Date.now()) / 60_000))
}

/* ─── Body builders ─────────────────────────────────────────── */

function buildItems(items: DispatchParams["items"]) {
  const { weight, volume } = itemDefaults()
  const list = items.length
    ? items
    : [{ description: "Pedido Náufrago", quantity: 1, priceUsd: 0 }]
  return list.map((it) => ({
    type: "STANDARD",
    value: it.priceUsd,
    quantity: it.quantity,
    description: it.description.slice(0, 235),
    weight,
    volume,
  }))
}

function dropoffWaypoint(
  dropoff: Address,
  name: string,
  phone: string,
) {
  return {
    type: "DROP_OFF",
    addressStreet: dropoff.street,
    addressAdditional: dropoff.detail || undefined,
    city: dropoffCity(),
    latitude: dropoff.latitude,
    longitude: dropoff.longitude,
    phone,
    name,
  }
}

function pickupWaypoint() {
  const p = getPickup()
  return {
    type: "PICK_UP",
    addressStreet: p.addressStreet,
    city: p.city,
    latitude: p.latitude,
    longitude: p.longitude,
    phone: p.phone,
    name: p.name,
  }
}

/* ─── Webhook static-key auth ───────────────────────────────── */

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/* ─── The provider implementation ───────────────────────────── */

export const pedidosYaCourier: CourierProvider = {
  id: PROVIDER_ID,
  label: "PedidosYa Courier (EC)",

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const body = {
      referenceId: "NAUFRAGO-QUOTE",
      isTest: isTestMode(),
      items: buildItems(params.items),
      waypoints: [
        pickupWaypoint(),
        // En cotización aún no hay contacto real del cliente ·
        // placeholders (PedidosYa solo necesita la dirección para
        // precio + distancia). El contacto real va en dispatch().
        dropoffWaypoint(params.dropoff, "Cliente", getPickup().phone),
      ],
    }
    const res = await authedFetch("/v3/shippings/estimates", {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new CourierShapeError(`quote_${res.status}:${text.slice(0, 300)}`)
    }
    const json = (await res.json()) as Record<string, unknown>
    const estimateId = asString(json.estimateId)
    if (!estimateId) throw new CourierShapeError("quote_missing_estimateId")
    const offers = Array.isArray(json.deliveryOffers)
      ? (json.deliveryOffers as Record<string, unknown>[])
      : []
    const offer = offers[0]
    if (!offer) throw new CourierShapeError("quote_no_delivery_offers")
    const pricing = asObject(offer.pricing)
    // Real shape · pricing.total (num) · confirmationTimeLimit (ISO).
    const priceUsd = asNumber(pricing?.total) ?? 0
    const expiresAt =
      asString(offer.confirmationTimeLimit) ??
      new Date(Date.now() + 5 * 60_000).toISOString()
    // ETA no viene en el estimate (aparece post-confirm) · 0 acá.
    const etaMinutes =
      minutesUntil(asString(offer.deliveryTimeTo)) ??
      asNumber(offer.estimatedDrivingTime) ??
      0
    return { quoteToken: estimateId, priceUsd, etaMinutes, expiresAt, raw: json }
  },

  async dispatch(params: DispatchParams): Promise<DispatchResult> {
    // Creación en 1 paso · POST /v3/shippings con el contacto REAL
    // del cliente (el estimate previo se hizo con placeholders, así
    // que re-creamos con name/phone verdaderos). referenceId lleva
    // nuestro order code para cross-referencia en el panel PedidosYa.
    const body = {
      referenceId:
        params.externalReference || params.quoteToken || "NAUFRAGO-ORDER",
      isTest: isTestMode(),
      notificationMail: params.customer.email || undefined,
      items: buildItems(params.items),
      waypoints: [
        pickupWaypoint(),
        {
          ...dropoffWaypoint(
            params.dropoff,
            params.customer.name,
            params.customer.phone,
          ),
          instructions: params.notes || undefined,
          // R144 · cobro en la puerta. Probado contra la cuenta real
          // 30-ago: PedidosYa acepta el campo y lo devuelve de vuelta,
          // y valida el techo (rechaza con COLLECT_MONEY_EXCEEDED). Si
          // la función estuviera apagada devolvería otro error distinto
          // (NOT_SUPPORTED_COLLECT_MONEY) · no es el caso.
          ...(params.collectMoneyUsd && params.collectMoneyUsd > 0
            ? { collectMoney: Number(params.collectMoneyUsd.toFixed(2)) }
            : {}),
        },
      ],
    }
    const res = await authedFetch("/v3/shippings", {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new CourierShapeError(`dispatch_${res.status}:${text.slice(0, 300)}`)
    }
    const json = (await res.json()) as Record<string, unknown>
    const shippingId = asString(json.shippingId)
    if (!shippingId) throw new CourierShapeError("dispatch_missing_shippingId")
    // R107 · el despacho SÍ trae el precio y la ventana de entrega,
    // dentro de `route`. Verificado con un despacho real de prueba
    // 25-ago: route.pricing.total = 4.3 · route.deliveryTimeTo con
    // la ventana · route.estimatedDrivingTime en minutos.
    // Esta es la cifra autoritativa del envío · el estimate previo
    // podía quedar viejo y el navegador no es fuente confiable.
    const ruta = asObject(json.route)
    const precios = asObject(ruta?.pricing)
    return {
      providerOrderId: shippingId,
      trackingUrl: asString(json.shareLocationUrl),
      providerStatus: asString(json.status) ?? "CONFIRMED",
      priceUsd: asNumber(precios?.total),
      etaMinutes:
        minutesUntil(asString(ruta?.deliveryTimeTo)) ??
        asNumber(ruta?.estimatedDrivingTime),
      raw: json,
    }
  },

  async getStatus(providerOrderId: string): Promise<StatusSnapshot> {
    const res = await authedFetch(`/v3/shippings/${providerOrderId}`)
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new CourierShapeError(`status_${res.status}:${text.slice(0, 300)}`)
    }
    const json = (await res.json()) as Record<string, unknown>
    const providerStatus = asString(json.status) ?? "UNKNOWN"
    const mapped = mapProviderStatus(providerStatus)

    // Posición del rider en vivo · solo disponible IN_PROGRESS+.
    // El endpoint /tracking devuelve latitude/longitude/deliveryName/
    // deliveryTransport/estimatedDropOffTime. Best-effort · si falla
    // (orden aún no en curso) no rompemos el status.
    let riderInfo: RiderInfo | undefined
    let etaMinutes: number | undefined
    const live = new Set(["IN_PROGRESS", "NEAR_PICKUP", "PICKED_UP", "NEAR_DROPOFF"])
    if (live.has(providerStatus.toUpperCase())) {
      try {
        const tRes = await authedFetch(`/v3/shippings/${providerOrderId}/tracking`)
        if (tRes.ok) {
          const t = (await tRes.json()) as Record<string, unknown>
          riderInfo = {
            name: asString(t.deliveryName),
            vehicleType: asString(t.deliveryTransport),
            latitude: asNumber(t.latitude),
            longitude: asNumber(t.longitude),
          }
          etaMinutes = minutesUntil(asString(t.estimatedDropOffTime))
        }
      } catch {
        // tracking no disponible aún · seguimos con el status base.
      }
    }
    return { providerStatus, mappedStatus: mapped, etaMinutes, riderInfo, raw: json }
  },

  async cancel(providerOrderId: string, reason?: string): Promise<void> {
    // Solo cancelables por API las órdenes en CONFIRMED · una vez
    // IN_PROGRESS hay que contactar a PedidosYa (la API devuelve error
    // y el caller lo surface-a con mensaje amable).
    const res = await authedFetch(`/v3/shippings/${providerOrderId}/cancel`, {
      method: "POST",
      body: JSON.stringify({
        reasonText: reason ?? "Cancelado por el comercio",
      }),
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "")
      throw new CourierShapeError(`cancel_${res.status}:${text.slice(0, 300)}`)
    }
  },

  verifyWebhookSignature(
    _rawBody: string,
    headers: Record<string, string | null | undefined>,
  ): boolean {
    // PedidosYa NO firma con HMAC. Seguridad = clave estática: cuando
    // configuras authorizationKey, invocan tu callback mandando esa
    // clave en los headers Authorization y x-api-key. Validamos que
    // alguno matchee PEDIDOSYA_COURIER_WEBHOOK_KEY.
    const key = envOptional("PEDIDOSYA_COURIER_WEBHOOK_KEY")
    if (!key) {
      // Sin clave configurada · fail-closed en prod · permitir en dev.
      return process.env.NODE_ENV !== "production"
    }
    const provided =
      headers["authorization"] ??
      headers["Authorization"] ??
      headers["x-api-key"] ??
      headers["X-Api-Key"] ??
      null
    if (!provided) return false
    return safeEqual(provided, key)
  },

  parseWebhookEvent(rawBody: string): WebhookEvent {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      throw new CourierShapeError("webhook_invalid_json")
    }
    // Callback real · { topic, id, referenceId, generated, transmitted,
    //   data: { status, cancelCode?, cancelReason? } }. id = shippingId.
    const providerOrderId = asString(parsed.id)
    if (!providerOrderId) throw new CourierShapeError("webhook_missing_id")
    const data = asObject(parsed.data) ?? {}
    const providerStatus = asString(data.status) ?? "UNKNOWN"
    return {
      providerOrderId,
      providerStatus,
      mappedStatus: mapProviderStatus(providerStatus),
      timestamp:
        asString(parsed.generated) ??
        asString(parsed.transmitted) ??
        new Date().toISOString(),
      // El callback de estado no trae posición del rider · solo status.
      riderInfo: undefined,
      payload: parsed,
    }
  },
}
