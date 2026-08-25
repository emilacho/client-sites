import "server-only"
/**
 * CourierProvider · Round 97.
 *
 * Pluggable abstraction for every "rider-on-demand" service the
 * landing can dispatch through. PedidosYa Courier is the only
 * implementation today · Rappi, Uber Eats, and Náufrago's own
 * delivery layer become drop-in additions later by implementing
 * this same interface.
 *
 * Used by:
 *  - POST /api/checkout/quote      (iterates active providers
 *                                   and returns each one's quote)
 *  - POST /api/checkout/confirm    (calls dispatch on the picked
 *                                   provider · persists row)
 *  - POST /api/courier/webhook/[provider]   (verifyWebhookSignature
 *                                            + parseWebhookEvent)
 *  - GET  /api/orders/[id]         (calls getStatus to refresh
 *                                   rider info when polling)
 *  - POST /api/orders/[id]/cancel  (calls cancel)
 *
 * Money everywhere is USD numeric (precision 2). All addresses
 * are in our normalized shape (lat/lng decimal degrees,
 * countryCode ISO-3166 alpha-2).
 */
import type {
  DeliveryProvider,
  NaufragoOrderStatus,
} from "@/lib/schemas"

/* ─── Shared shapes ─────────────────────────────────────────── */

export interface Address {
  street: string
  detail?: string | null
  countryCode: string // "EC"
  latitude?: number
  longitude?: number
}

export interface ContactInfo {
  name: string
  phone: string
  email?: string | null
}

export interface DispatchItem {
  /** Short human label · "1× Encebollado Náufrago" · shown to rider */
  description: string
  quantity: number
  /** Per-unit price · USD · used by some providers to size the
   *  rider's vehicle (motorbike vs car) and insurance. */
  priceUsd: number
}

/* ─── Quote ─────────────────────────────────────────────────── */

export interface QuoteParams {
  dropoff: Address
  items: DispatchItem[]
  cartTotalUsd: number
}

export interface QuoteResult {
  /** Opaque token issued by the provider · pass back to dispatch()
   *  within the expiry window (typically 5-15 min). */
  quoteToken: string
  /** Final price the customer pays for the delivery · USD. */
  priceUsd: number
  /** Door-to-door minutes from dispatch to delivered · best estimate. */
  etaMinutes: number
  /** ISO 8601 timestamp the quote becomes invalid. */
  expiresAt: string
  /** Verbatim response from the provider · stored as
   *  raw_dispatch_response on the row for forensic debugging. */
  raw: unknown
}

/* ─── Dispatch ──────────────────────────────────────────────── */

export interface DispatchParams {
  quoteToken: string
  dropoff: Address
  customer: ContactInfo
  items: DispatchItem[]
  /** Optional notes shown to the rider · "Pitar 2 veces" etc. */
  notes?: string | null
  /** Our internal order code · passed to the provider for
   *  cross-referencing in their dashboard. */
  externalReference?: string
}

export interface DispatchResult {
  /** Provider's tracking id · stored as
   *  delivery_provider_order_id on the row. */
  providerOrderId: string
  /** R107 · precio REAL del envío que el proveedor confirmó al
   *  despachar · es la cifra autoritativa: no la del navegador ni
   *  la de una re-cotización que podría diferir. Ausente = el
   *  proveedor no lo informa en el despacho. */
  priceUsd?: number
  /** R107 · minutos hasta la entrega según el proveedor, contados
   *  al momento del despacho. Ausente = no lo informa. */
  etaMinutes?: number
  /** Optional URL the customer can hit to see the provider's
   *  own tracker · shown as a fallback. */
  trackingUrl?: string
  /** Provider's native status string · raw, NOT mapped. */
  providerStatus: string
  raw: unknown
}

/* ─── Status polling ────────────────────────────────────────── */

export interface RiderInfo {
  name?: string
  phone?: string
  plate?: string
  vehicleType?: string
  latitude?: number
  longitude?: number
  photoUrl?: string
}

export interface StatusSnapshot {
  /** Provider's native status string. */
  providerStatus: string
  /** Mapped to our internal enum · null if the provider's status
   *  doesn't map cleanly (rare · we add cases as we see them). */
  mappedStatus: NaufragoOrderStatus | null
  etaMinutes?: number
  riderInfo?: RiderInfo
  raw: unknown
}

/* ─── Webhook events ────────────────────────────────────────── */

export interface WebhookEvent {
  /** Provider's tracking id · the column we look up the row by. */
  providerOrderId: string
  /** Provider's native event/status string. */
  providerStatus: string
  /** Mapped to our internal enum. */
  mappedStatus: NaufragoOrderStatus | null
  timestamp: string
  /** Optional rider info from the event payload · used to update
   *  the rider_info jsonb column in real time. */
  riderInfo?: RiderInfo
  payload: Record<string, unknown>
}

/* ─── The provider interface itself ─────────────────────────── */

export interface CourierProvider {
  /** Matches DeliveryProvider enum string · stable id. */
  id: DeliveryProvider
  /** Human label for debug · "PedidosYa Courier (EC)" */
  label: string

  /** Pull a delivery quote · throws on error. */
  getQuote(params: QuoteParams): Promise<QuoteResult>

  /** Promote a quote to an actual dispatched order. */
  dispatch(params: DispatchParams): Promise<DispatchResult>

  /** Pull the current status snapshot for an already-dispatched
   *  order · used by the polling fallback when webhooks lag. */
  getStatus(providerOrderId: string): Promise<StatusSnapshot>

  /** Cancel a dispatched order · throws if the provider can't
   *  cancel (rider already picked up, etc.). Caller catches and
   *  surfaces a friendly message. */
  cancel(providerOrderId: string, reason?: string): Promise<void>

  /** Verify the signature on an incoming webhook · returns true
   *  if the signature header matches the body HMAC. */
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string | null | undefined>,
  ): boolean

  /** Parse a webhook payload into our normalized shape · maps the
   *  provider's native status to our enum. */
  parseWebhookEvent(rawBody: string): WebhookEvent
}

/* ─── Errors ────────────────────────────────────────────────── */

/**
 * Thrown when a server-only env var the provider needs is
 * missing. The API route catches this and returns a 503 with the
 * specific var name so the operator knows what to set.
 */
export class CourierEnvError extends Error {
  constructor(public readonly varName: string) {
    super(`courier_env_missing:${varName}`)
    this.name = "CourierEnvError"
  }
}

/**
 * Thrown when the provider returns an unexpected response shape ·
 * means our integration assumptions don't match reality and the
 * code needs an update. The API route surfaces this as 502.
 */
export class CourierShapeError extends Error {
  constructor(detail: string) {
    super(`courier_shape_error:${detail}`)
    this.name = "CourierShapeError"
  }
}
