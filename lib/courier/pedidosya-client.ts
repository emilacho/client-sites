import "server-only"
/**
 * PedidosYa Courier API client · Round 74.
 *
 *  ⚠ SCAFFOLD · the exact endpoint paths, payload field names, and
 *  HMAC signature header are marked TODO(R74) inline. The docs
 *  (https://developers.pedidosya.com/courier-doc/first-steps and
 *  /courier-api) render client-side as a SPA so they could not be
 *  read automatically · the values below are placeholders based on
 *  the conventional PedidosYa Courier B2B API shape used in other
 *  LATAM markets. Verify against the live docs OR the Postman
 *  collection PedidosYa hands out with credentials before wiring
 *  to production.
 *
 *  Required environment variables (drop into `.env.local`):
 *    PEDIDOSYA_COURIER_BASE_URL          · prod    https://courier-api.pedidosya.com
 *                                          sandbox https://courier-api-stg.pedidosya.com
 *    PEDIDOSYA_COURIER_CLIENT_ID         · per docs
 *    PEDIDOSYA_COURIER_CLIENT_SECRET     · per docs
 *    PEDIDOSYA_COURIER_COUNTRY_CODE      · "EC" for Náufrago Olón
 *    PEDIDOSYA_COURIER_PICKUP_ADDRESS    · canonical pickup street
 *                                          (Náufrago kitchen)
 *    PEDIDOSYA_COURIER_PICKUP_LAT        · pickup decimal lat
 *    PEDIDOSYA_COURIER_PICKUP_LNG        · pickup decimal lng
 *    PEDIDOSYA_COURIER_WEBHOOK_SECRET    · HMAC key for webhook
 *                                          signature verification
 *
 *  Lifecycle · the client manages its own bearer token in-process
 *  (Map keyed by env so dev + test don't collide). Tokens are
 *  refreshed on 401 retries or on expiry. No persistent token
 *  cache · this runs on the Node runtime so per-instance state
 *  is fine for low/mid traffic.
 */

interface TokenCache {
  token: string
  expiresAt: number // ms epoch
}

const tokenCache = new Map<string, TokenCache>()

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`courier_env_missing:${name}`)
  return value
}

function envOptional(name: string): string | undefined {
  return process.env[name] || undefined
}

function getBaseUrl(): string {
  return (
    envOptional("PEDIDOSYA_COURIER_BASE_URL") ??
    // Default to staging for safety · explicit env switch promotes
    // to production. Real URL TBD per docs.
    "https://courier-api-stg.pedidosya.com"
  )
}

async function getAccessToken(): Promise<string> {
  const clientId = requireEnv("PEDIDOSYA_COURIER_CLIENT_ID")
  const clientSecret = requireEnv("PEDIDOSYA_COURIER_CLIENT_SECRET")
  const cacheKey = `${getBaseUrl()}::${clientId}`
  const cached = tokenCache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token

  // TODO(R74) · confirm the token endpoint path + body format.
  //   Conventional PedidosYa pattern (per their sister LATAM APIs):
  //     POST {baseUrl}/v3/oauth/token
  //     Headers · Content-Type: application/x-www-form-urlencoded
  //     Body    · grant_type=client_credentials&client_id=...&client_secret=...
  //   Response · { access_token, token_type, expires_in }
  const tokenUrl = `${getBaseUrl()}/v3/oauth/token`
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  })
  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`courier_token_failed:${res.status}:${text.slice(0, 200)}`)
  }
  const json = (await res.json()) as {
    access_token?: string
    token_type?: string
    expires_in?: number
  }
  if (!json.access_token)
    throw new Error("courier_token_failed:no_access_token_in_response")
  const expiresInMs = (json.expires_in ?? 3600) * 1000
  tokenCache.set(cacheKey, {
    token: json.access_token,
    expiresAt: Date.now() + expiresInMs,
  })
  return json.access_token
}

interface AuthedRequestInit extends Omit<RequestInit, "headers"> {
  headers?: Record<string, string>
}

async function authedFetch(
  path: string,
  init: AuthedRequestInit = {},
): Promise<Response> {
  const token = await getAccessToken()
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
    ...(init.headers ?? {}),
  }
  return fetch(`${getBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })
}

/* ─── Quote / estimate ────────────────────────────────────────── */

export interface QuoteParams {
  dropoff: {
    street: string
    detail?: string
    countryCode?: string
    latitude?: number
    longitude?: number
  }
  /** Sum of cart line subtotals · used by PedidosYa to size the
   *  rider (bag vs cargo). */
  cartTotalUsd: number
  /** Number of distinct items · same purpose. */
  itemCount: number
}

export interface QuoteResult {
  quoteToken: string
  priceUsd: number
  etaMinutes: number
  expiresAt: string // ISO
  raw: unknown // verbatim response · stored for debugging
}

export async function getDeliveryQuote(
  params: QuoteParams,
): Promise<QuoteResult> {
  // TODO(R74) · confirm estimates endpoint + payload field names.
  //   Conventional shape:
  //     POST /v3/estimates/orders
  //     {
  //       waypoints: [
  //         { type: "PICKUP",  addressStreet, lat, lng, countryCode },
  //         { type: "DROPOFF", addressStreet, lat, lng, countryCode, detail }
  //       ],
  //       items: [{ description, quantity, priceUsd }],
  //       paymentMethod: "BUSINESS_ACCOUNT"
  //     }
  //   Response keys we map · estimateId, deliveryOfferPrice,
  //     deliveryTimeInMinutes, expirationDate.
  const countryCode =
    params.dropoff.countryCode ??
    envOptional("PEDIDOSYA_COURIER_COUNTRY_CODE") ??
    "EC"
  const pickupStreet = requireEnv("PEDIDOSYA_COURIER_PICKUP_ADDRESS")
  const pickupLat = Number(requireEnv("PEDIDOSYA_COURIER_PICKUP_LAT"))
  const pickupLng = Number(requireEnv("PEDIDOSYA_COURIER_PICKUP_LNG"))

  const body = {
    waypoints: [
      {
        type: "PICKUP",
        addressStreet: pickupStreet,
        countryCode,
        latitude: pickupLat,
        longitude: pickupLng,
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
    items: [
      {
        description: `Náufrago · ${params.itemCount} item(s)`,
        quantity: params.itemCount,
        priceUsd: params.cartTotalUsd,
      },
    ],
  }

  const res = await authedFetch("/v3/estimates/orders", {
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`courier_quote_failed:${res.status}:${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as {
    estimateId?: string
    deliveryOfferPrice?: number
    deliveryTimeInMinutes?: number
    expirationDate?: string
  }
  if (!json.estimateId)
    throw new Error("courier_quote_failed:no_estimate_id_in_response")
  return {
    quoteToken: json.estimateId,
    priceUsd: json.deliveryOfferPrice ?? 0,
    etaMinutes: json.deliveryTimeInMinutes ?? 0,
    expiresAt: json.expirationDate ?? new Date(Date.now() + 5 * 60_000).toISOString(),
    raw: json,
  }
}

/* ─── Create order ────────────────────────────────────────────── */

export interface CreateOrderParams {
  quoteToken: string
  dropoff: QuoteParams["dropoff"]
  customer: { name: string; phone: string; email?: string }
  lines: Array<{ name: string; qty: number; priceUsd: number }>
  notes?: string
}

export interface CreateOrderResult {
  orderId: string
  trackingUrl?: string
  status: string
  raw: unknown
}

export async function createOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  // TODO(R74) · confirm orders endpoint + payload shape.
  //   Conventional:
  //     POST /v3/orders
  //     { estimateId, contactInfo: {...}, instructions, items: [...] }
  const body = {
    estimateId: params.quoteToken,
    contactInfo: {
      pickupContactName: "Náufrago",
      pickupContactPhone: envOptional("PEDIDOSYA_COURIER_PICKUP_PHONE"),
      dropoffContactName: params.customer.name,
      dropoffContactPhone: params.customer.phone,
      dropoffContactEmail: params.customer.email || undefined,
    },
    instructions: params.notes || undefined,
    items: params.lines.map((l) => ({
      description: l.name,
      quantity: l.qty,
      priceUsd: l.priceUsd,
    })),
  }

  const res = await authedFetch("/v3/orders", {
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`courier_order_failed:${res.status}:${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as {
    orderId?: string
    trackingUrl?: string
    status?: string
  }
  if (!json.orderId)
    throw new Error("courier_order_failed:no_order_id_in_response")
  return {
    orderId: json.orderId,
    trackingUrl: json.trackingUrl,
    status: json.status ?? "CREATED",
    raw: json,
  }
}

/* ─── Webhook signature ──────────────────────────────────────── */

import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * Verify a PedidosYa webhook signature. The exact header name +
 * signature format need confirmation from the docs.
 *
 * TODO(R74) · per docs, set the correct header (likely
 * `x-pedidosya-signature`) and signature format (likely
 * `sha256=HEXDIGEST` over the raw request body).
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  if (!signatureHeader) return false
  const secret = envOptional("PEDIDOSYA_COURIER_WEBHOOK_SECRET")
  if (!secret) {
    // Fail closed if no secret is configured in production · in dev
    // (NODE_ENV !== production) we allow unsigned for easier
    // local testing.
    return process.env.NODE_ENV !== "production"
  }
  const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex")
  // Common PedidosYa shape is either `sha256=<hex>` or bare hex.
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader
  if (provided.length !== expectedHex.length) return false
  return timingSafeEqual(
    Buffer.from(provided, "hex"),
    Buffer.from(expectedHex, "hex"),
  )
}
