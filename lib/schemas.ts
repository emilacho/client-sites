import { z } from "zod"

export const contactSubmissionSchema = z.object({
  name: z.string().min(1, "name_required").max(120),
  email: z.string().email("invalid_email").max(180),
  phone: z.string().max(40).optional().or(z.literal("")),
  message: z.string().min(1, "message_required").max(4000),
})

export type ContactSubmissionInput = z.infer<typeof contactSubmissionSchema>

/* ─── Round 74 · PedidosYa Courier integration ────────────────────
 *
 * Schemas for the customer-facing delivery flow:
 *   1. Customer enters drop-off address + contact in the cart →
 *      we call /api/courier/quote with { dropoff, cart total }
 *   2. We hit PedidosYa Courier `POST estimates/orders` server-side
 *      → return price + ETA + opaque quote token
 *   3. Customer confirms → /api/courier/order creates the actual
 *      delivery with the saved token + persists to Supabase
 *   4. PedidosYa POSTs to /api/courier/webhook on status change
 *      → we update the row + (optional) push to the customer
 *
 * Field names follow the conventional PedidosYa courier payload
 * shapes (waypoints[], items[], confirmationCode) per their LATAM
 * sister APIs. Exact names verified against docs in the
 * pedidosya-client.ts TODO block.
 */

const addressSchema = z.object({
  street: z.string().min(1).max(200),
  // Free-form floor / apt / reference · the courier driver reads it
  detail: z.string().max(200).optional().or(z.literal("")),
  // ISO country code · "EC" for Náufrago Olón. Falls back to env.
  countryCode: z.string().length(2).optional(),
  // Decimal degrees · captured from the address-picker step. If
  // omitted, the server geocodes via PedidosYa's address resolver.
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
})

const contactSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(6).max(40),
  // Optional · only used for email confirmation. Most LATAM food
  // orders identify by phone alone.
  email: z.string().email().max(180).optional().or(z.literal("")),
})

const cartLineSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  priceUsd: z.number().min(0).max(10_000),
  qty: z.number().int().min(1).max(99),
})

export const courierQuoteRequestSchema = z.object({
  dropoff: addressSchema,
  lines: z.array(cartLineSchema).min(1).max(99),
})
export type CourierQuoteRequest = z.infer<typeof courierQuoteRequestSchema>

export const courierOrderRequestSchema = z.object({
  // The quote token returned by /api/courier/quote · server-side
  // re-verifies that the token is still valid (PedidosYa quotes
  // typically expire in 5-15 min) before promoting to an order.
  quoteToken: z.string().min(1).max(500),
  dropoff: addressSchema,
  customer: contactSchema,
  lines: z.array(cartLineSchema).min(1).max(99),
  // Optional delivery instructions visible to the rider.
  notes: z.string().max(500).optional().or(z.literal("")),
})
export type CourierOrderRequest = z.infer<typeof courierOrderRequestSchema>

/* Webhook payload · loose shape until docs confirm the exact
 * envelope. PedidosYa typically POSTs:
 *   { event, orderId, status, timestamp, payload }
 * with HMAC-SHA256 signature in X-PedidosYa-Signature (header
 * name TBD per docs). We accept any object and validate
 * narrowly inside the route. */
export const courierWebhookEventSchema = z.object({
  event: z.string().min(1).max(120),
  orderId: z.string().min(1).max(120),
  status: z.string().min(1).max(80),
  timestamp: z.string().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})
export type CourierWebhookEvent = z.infer<typeof courierWebhookEventSchema>

/* ─── Round 96 · Náufrago orders schema ──────────────────────────
 *
 * Schemas + enum strings for the unified `naufrago_orders` table.
 * Mirrors the SQL constraints in
 * supabase/migrations/20260519_naufrago_orders.sql so the API
 * routes can validate before insert and TypeScript reflects the
 * exact db shape.
 *
 * Supersedes the R74 courier* schemas above · the R74 set stays
 * for backwards-compat references while R97+ rolls in.
 */

export const NAUFRAGO_ORDER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "RIDER_PICKED_UP",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
] as const
export type NaufragoOrderStatus = (typeof NAUFRAGO_ORDER_STATUSES)[number]

export const DELIVERY_PROVIDERS = [
  "PEDIDOSYA_COURIER",
  "RAPPI_COURIER",
  "UBER_EATS_COURIER",
  "NAUFRAGO_OWN_DELIVERY",
  "PICKUP",
] as const
export type DeliveryProvider = (typeof DELIVERY_PROVIDERS)[number]

export const PAYMENT_METHODS = [
  "GOOGLE_PAY",
  "APPLE_PAY",
  "CARD_CREDIT",
  "CARD_DEBIT",
  "PAYPHONE",
  "CASH_ON_DELIVERY",
  "WHATSAPP_MANUAL",
  "BANK_TRANSFER",
] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

export const PAYMENT_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "REFUNDED",
  "PARTIAL_REFUND",
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const NAUFRAGO_ORDER_EVENT_TYPES = [
  "ORDER_CREATED",
  "PAYMENT_AUTHORIZED",
  "PAYMENT_CAPTURED",
  "PAYMENT_FAILED",
  "KITCHEN_ACCEPTED",
  "KITCHEN_REJECTED",
  "PREPARING_STARTED",
  "READY_FOR_PICKUP",
  "COURIER_DISPATCHED",
  "COURIER_ASSIGNED",
  "COURIER_PICKED_UP",
  "COURIER_IN_TRANSIT",
  "COURIER_NEAR_DESTINATION",
  "DELIVERED",
  "CANCELLED",
  "STATUS_OVERRIDE_MANUAL",
  "WEBHOOK_RECEIVED",
] as const
export type NaufragoOrderEventType =
  (typeof NAUFRAGO_ORDER_EVENT_TYPES)[number]

/* ─── Inputs ─────────────────────────────────────────────────── */

// Re-used address / contact / cart shapes from the R74 block above.
// Tighter validation per the new flow's needs.
const naufragoCartLineSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(200),
  priceUsd: z.number().min(0).max(10_000),
  qty: z.number().int().min(1).max(99),
})

/**
 * POST /api/checkout/quote · landing asks for quotes from every
 * active delivery provider for the supplied dropoff + cart. The
 * server iterates `availableProviders` and returns each one's
 * price + ETA. Customer compares + picks.
 */
export const checkoutQuoteRequestSchema = z.object({
  dropoff: addressSchema,
  lines: z.array(naufragoCartLineSchema).min(1).max(99),
})
export type CheckoutQuoteRequest = z.infer<typeof checkoutQuoteRequestSchema>

/**
 * POST /api/checkout/confirm · final commit · customer has chosen
 * delivery provider + payment method, server creates the order
 * row, processes payment, dispatches the rider.
 */
export const checkoutConfirmRequestSchema = z.object({
  // Cart + dropoff (same as quote)
  dropoff: addressSchema,
  lines: z.array(naufragoCartLineSchema).min(1).max(99),
  // Customer
  customer: z.object({
    name: z.string().min(1).max(120),
    phone: z.string().min(6).max(40),
    email: z.string().email().max(180).optional().or(z.literal("")),
  }),
  // Delivery
  deliveryProvider: z.enum(DELIVERY_PROVIDERS),
  // Quote token the provider issued during /quote · re-validated
  // server-side before we commit.
  deliveryQuoteToken: z.string().min(1).max(500),
  // Optional special instructions visible to the rider/kitchen.
  customerNotes: z.string().max(500).optional().or(z.literal("")),
  // Money · server re-computes to prevent client-side tampering ·
  // these are sent for display reconciliation only.
  subtotalUsd: z.number().min(0).max(10_000),
  discountCode: z.string().max(80).optional().or(z.literal("")),
  // Payment
  paymentMethod: z.enum(PAYMENT_METHODS),
  // Payment provider session/intent id when the gateway already
  // tokenized the method (Google Pay / Apple Pay / card via
  // Kushki/Stripe redirect). Optional for CASH / WHATSAPP_MANUAL.
  paymentProviderIntentId: z.string().max(200).optional().or(z.literal("")),
})
export type CheckoutConfirmRequest = z.infer<typeof checkoutConfirmRequestSchema>

/**
 * PUT /api/orders/[id]/status · staff / webhook advances status.
 * Validation is loose on the transition itself · the API route
 * enforces legal transitions server-side (e.g. you can't go from
 * DELIVERED back to PREPARING).
 */
export const orderStatusUpdateSchema = z.object({
  status: z.enum(NAUFRAGO_ORDER_STATUSES),
  reason: z.string().max(500).optional().or(z.literal("")),
  actor: z
    .enum(["system", "customer", "staff", "webhook:pedidosya-courier"])
    .default("staff"),
})
export type OrderStatusUpdate = z.infer<typeof orderStatusUpdateSchema>
