import "server-only"
/**
 * PedidosYa Courier API · CourierProvider implementation.
 *
 * Round 97 (this file) supersedes the R74 `pedidosya-client.ts`
 * scaffold · it folds into the new CourierProvider interface so
 * the API routes can swap to Rappi / Uber Eats / etc. without
 * touching their own code.
 *
 * Endpoint paths + payload field names are based on the
 * conventional PedidosYa Courier B2B API shape seen across
 * their LATAM markets. They are still TODO-verifiable against
 * the actual Courier API docs (which are SPA-rendered and
 * require credentials to fully unfold). The structure is correct
 * · only the exact strings may need a 4-line adjustment when
 * credentials arrive and the Postman collection / OpenAPI spec
 * is in hand.
 *
 * Required environment variables (server-only):
 *   PEDIDOSYA_COURIER_BASE_URL          · prod or staging
 *   PEDIDOSYA_COURIER_CLIENT_ID
 *   PEDIDOSYA_COURIER_CLIENT_SECRET
 *   PEDIDOSYA_COURIER_COUNTRY_CODE      · EC
 *   PEDIDOSYA_COURIER_PICKUP_ADDRESS    · Náufrago kitchen street
 *   PEDIDOSYA_COURIER_PICKUP_LAT        · decimal degrees
 *   PEDIDOSYA_COURIER_PICKUP_LNG        · decimal degrees
 *   PEDIDOSYA_COURIER_PICKUP_PHONE      · optional · for rider Q&A
 *   PEDIDOSYA_COURIER_WEBHOOK_SECRET    · HMAC key
 */
import { createHmac, timingSafeEqual } from "node:crypto"
import type { NaufragoOrderStatus } from "@/lib/schemas"
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

/* ─── Env helpers ───────────────────────────────────────────── */

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new CourierEnvError(name)
  return v
}

function envOptional(name: string): string | undefined {
  return process.env[name] || undefined
}

function getBaseUrl(): string {
  return (
    envOptional("PEDIDOSYA_COURIER_BASE_URL") ??
    "https://courier-api-stg.pedidosya.com"
  )
}

function getPickupAddress(): Address {
  return {
    street: requireEnv("PEDIDOSYA_COURIER_PICKUP_ADDRESS"),
    countryCode:
      envOptional("PEDIDOSYA_COURIER_COUNTRY_CODE") ?? "EC",
    latitude: Number(requireEnv("PEDIDOSYA_COURIER_PICKUP_LAT")),
    longitude: Number(requireEnv("PEDIDOSYA_COURIER_PICKUP_LNG")),
  }
}

/* ─── OAuth2 client_credentials token cache ─────────────────── */

interface TokenCacheEntry {
  token: string
  expiresAt: number
}
const tokenCache = new Map<string, TokenCacheEntry>()

async function getAccessToken(): Promise<string> {
  const clientId = requireEnv("PEDIDOSYA_COURIER_CLIENT_ID")
  const clientSecret = requireEnv("PEDIDOSYA_COURIER_CLIENT_SECRET")
  const cacheKey = `${getBaseUrl()}::${clientId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token

  // TODO(R97) · confirm token endpoint path + body format vs the
  // Courier API docs. Conventional Delivery Hero pattern is:
  //   POST {base}/v3/oauth/token
  //   Content-Type: application/x-www-form-urlencoded
  //   grant_type=client_credentials&client_id=...&client_secret=...
  // Response: { access_token, token_type, expires_in }
  const url = `${getBaseUrl()}/v3/oauth/token`
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new CourierShapeError(
      `token_endpoint_${res.status}:${text.slice(0, 200)}`,
    )
  }
  const json = (await res.json()) as {
    access_token?: string
    expires_in?: number
  }
  if (!json.access_token)
    throw new CourierShapeError("token_endpoint_missing_access_token")
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  })
  return json.access_token
}

async function authedFetch(
  path: string,
  init: { method?: string; body?: string } = {},
): Promise<Response> {
  const token = await getAccessToken()
  return fetch(`${getBaseUrl()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: init.body,
    cache: "no-store",
  })
}

/* ─── Status mapping ────────────────────────────────────────── */

/**
 * PedidosYa Courier emits its own status values along the
 * lifecycle. We map them to our NaufragoOrderStatus enum so the
 * tracker UI and admin views speak one language.
 *
 * The exact set of provider statuses is verified per-deployment
 * against the docs · this covers the canonical ones we've seen
 * across LATAM markets. Unrecognized strings return null and the
 * caller falls back to keeping the existing status + logging.
 */
function mapProviderStatus(
  provider: string,
): NaufragoOrderStatus | null {
  const u = provider.toUpperCase()
  switch (u) {
    case "CREATED":
    case "ASSIGNING":
    case "PENDING":
      return "ACCEPTED"
    case "ASSIGNED":
    case "DRIVER_ASSIGNED":
    case "DRIVER_NEAR_PICKUP":
    case "AT_PICKUP":
      return "READY"
    case "PICKED_UP":
    case "DRIVER_PICKED_UP":
      return "RIDER_PICKED_UP"
    case "IN_TRANSIT":
    case "EN_ROUTE":
    case "DRIVER_NEAR_DROPOFF":
    case "AT_DROPOFF":
      return "IN_TRANSIT"
    case "DELIVERED":
    case "COMPLETED":
      return "DELIVERED"
    case "CANCELLED":
    case "FAILED":
    case "EXPIRED":
      return "CANCELLED"
    default:
      return null
  }
}

/* ─── Webhook signature ─────────────────────────────────────── */

function verifyHmacSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader) return false
  const expected = createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader
  if (provided.length !== expected.length) return false
  try {
    return timingSafeEqual(
      Buffer.from(provided, "hex"),
      Buffer.from(expected, "hex"),
    )
  } catch {
    return false
  }
}

/* ─── Type helpers for provider responses ───────────────────── */

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined
}
function asObject(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined
}

function extractRiderInfo(payload: unknown): RiderInfo | undefined {
  const root = asObject(payload)
  if (!root) return undefined
  const driver =
    asObject(root.driver) ||
    asObject(root.rider) ||
    asObject(root.courier) ||
    asObject(root.dispatcher)
  if (!driver) return undefined
  const lat =
    asNumber(driver.latitude) ??
    asNumber(driver.lat) ??
    asNumber(asObject(driver.position)?.latitude) ??
    asNumber(asObject(driver.position)?.lat)
  const lng =
    asNumber(driver.longitude) ??
    asNumber(driver.lng) ??
    asNumber(asObject(driver.position)?.longitude) ??
    asNumber(asObject(driver.position)?.lng)
  return {
    name: asString(driver.name) ?? asString(driver.fullName),
    phone: asString(driver.phone) ?? asString(driver.phoneNumber),
    plate: asString(driver.plate) ?? asString(driver.vehiclePlate),
    vehicleType: asString(driver.vehicleType) ?? asString(driver.vehicle),
    latitude: lat,
    longitude: lng,
    photoUrl: asString(driver.photoUrl) ?? asString(driver.avatarUrl),
  }
}

/* ─── The provider implementation ───────────────────────────── */

export const pedidosYaCourier: CourierProvider = {
  id: "PEDIDOSYA_COURIER",
  label: "PedidosYa Courier (EC)",

  async getQuote(params: QuoteParams): Promise<QuoteResult> {
    const pickup = getPickupAddress()
    const countryCode = params.dropoff.countryCode || pickup.countryCode

    // TODO(R97) · confirm estimate endpoint + payload shape.
    const body = {
      waypoints: [
        {
          type: "PICKUP",
          addressStreet: pickup.street,
          countryCode,
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        },
        {
          type: "DROPOFF",
          addressStreet: params.dropoff.street,
          addressDetail: params.dropoff.detail || undefined,
          countryCode,
          latitude: params.dropoff.latitude,
          longitude: params.dropoff.longitude,
        },
      ],
      items: params.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        priceUsd: it.priceUsd,
      })),
      cartTotalUsd: params.cartTotalUsd,
    }

    const res = await authedFetch("/v3/estimates/orders", {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new CourierShapeError(
        `quote_${res.status}:${text.slice(0, 300)}`,
      )
    }
    const json = (await res.json()) as {
      estimateId?: string
      deliveryOfferPrice?: number
      deliveryTimeInMinutes?: number
      expirationDate?: string
    }
    if (!json.estimateId)
      throw new CourierShapeError("quote_missing_estimateId")
    return {
      quoteToken: json.estimateId,
      priceUsd: json.deliveryOfferPrice ?? 0,
      etaMinutes: json.deliveryTimeInMinutes ?? 0,
      expiresAt:
        json.expirationDate ??
        new Date(Date.now() + 5 * 60_000).toISOString(),
      raw: json,
    }
  },

  async dispatch(params: DispatchParams): Promise<DispatchResult> {
    // TODO(R97) · confirm orders endpoint + payload shape.
    const body = {
      estimateId: params.quoteToken,
      externalReference: params.externalReference,
      contactInfo: {
        pickupContactName: "Náufrago",
        pickupContactPhone:
          envOptional("PEDIDOSYA_COURIER_PICKUP_PHONE") || undefined,
        dropoffContactName: params.customer.name,
        dropoffContactPhone: params.customer.phone,
        dropoffContactEmail: params.customer.email || undefined,
      },
      instructions: params.notes || undefined,
      items: params.items.map((it) => ({
        description: it.description,
        quantity: it.quantity,
        priceUsd: it.priceUsd,
      })),
    }
    const res = await authedFetch("/v3/orders", {
      method: "POST",
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new CourierShapeError(
        `dispatch_${res.status}:${text.slice(0, 300)}`,
      )
    }
    const json = (await res.json()) as {
      orderId?: string
      trackingUrl?: string
      status?: string
    }
    if (!json.orderId)
      throw new CourierShapeError("dispatch_missing_orderId")
    return {
      providerOrderId: json.orderId,
      trackingUrl: json.trackingUrl,
      providerStatus: json.status ?? "CREATED",
      raw: json,
    }
  },

  async getStatus(providerOrderId: string): Promise<StatusSnapshot> {
    const res = await authedFetch(`/v3/orders/${providerOrderId}`)
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new CourierShapeError(
        `status_${res.status}:${text.slice(0, 300)}`,
      )
    }
    const json = (await res.json()) as Record<string, unknown>
    const providerStatus =
      asString(json.status) ??
      asString(json.orderStatus) ??
      "UNKNOWN"
    return {
      providerStatus,
      mappedStatus: mapProviderStatus(providerStatus),
      etaMinutes:
        asNumber(json.deliveryTimeInMinutes) ??
        asNumber(json.etaMinutes),
      riderInfo: extractRiderInfo(json),
      raw: json,
    }
  },

  async cancel(
    providerOrderId: string,
    reason?: string,
  ): Promise<void> {
    // TODO(R97) · some markets use DELETE, others POST · confirm
    // verb + path. Conventional shape:
    //   POST /v3/orders/{id}/cancel · body { reason }
    const res = await authedFetch(
      `/v3/orders/${providerOrderId}/cancel`,
      {
        method: "POST",
        body: JSON.stringify({ reason: reason ?? "merchant_cancelled" }),
      },
    )
    if (!res.ok && res.status !== 204) {
      const text = await res.text().catch(() => "")
      throw new CourierShapeError(
        `cancel_${res.status}:${text.slice(0, 300)}`,
      )
    }
  },

  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string | null | undefined>,
  ): boolean {
    const secret = envOptional("PEDIDOSYA_COURIER_WEBHOOK_SECRET")
    if (!secret) {
      // Local dev fallback · allow unsigned in non-production so
      // staging tests don't require the secret. In production
      // the env MUST be set or signatures fail closed.
      return process.env.NODE_ENV !== "production"
    }
    const sig =
      headers["x-pedidosya-signature"] ??
      headers["x-signature"] ??
      headers["x-pedidos-signature"] ??
      null
    return verifyHmacSignature(rawBody, sig, secret)
  },

  parseWebhookEvent(rawBody: string): WebhookEvent {
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(rawBody) as Record<string, unknown>
    } catch {
      throw new CourierShapeError("webhook_invalid_json")
    }
    // Different markets / SDK versions wrap the event differently:
    //   { event, orderId, status, payload }
    //   { data: { ... } }
    //   { type, body: { ... } }
    const body =
      asObject(parsed.data) ??
      asObject(parsed.body) ??
      parsed
    const providerOrderId =
      asString(body.orderId) ??
      asString(body.order_id) ??
      asString(body.id)
    if (!providerOrderId)
      throw new CourierShapeError("webhook_missing_orderId")
    const providerStatus =
      asString(body.status) ??
      asString(body.event) ??
      asString(body.type) ??
      "UNKNOWN"
    return {
      providerOrderId,
      providerStatus,
      mappedStatus: mapProviderStatus(providerStatus),
      timestamp:
        asString(body.timestamp) ??
        asString(body.eventTime) ??
        new Date().toISOString(),
      riderInfo: extractRiderInfo(body),
      payload: parsed,
    }
  },
}
