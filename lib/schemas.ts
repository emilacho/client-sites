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
