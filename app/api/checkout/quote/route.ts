import { NextResponse } from "next/server"
import { randomBytes } from "node:crypto"
import {
  checkoutQuoteRequestSchema,
  type PaymentMethod,
} from "@/lib/schemas"
import {
  getActiveCourierProviders,
  CourierEnvError,
} from "@/lib/courier"
import type {
  CourierProvider,
  DispatchItem,
} from "@/lib/courier/provider"
import {
  computeDiscount,
  computeSubtotalUsd,
  totalItemCount,
} from "@/lib/checkout/pricing"

export const runtime = "nodejs"

/**
 * Round 98 · POST /api/checkout/quote
 *
 * The landing's checkout flow calls this with the cart contents +
 * the customer's drop-off address. The server:
 *   1. Re-computes subtotal/discount server-side (anti-tamper).
 *   2. Iterates every active CourierProvider and returns a quote
 *      per provider so the UI can offer choices (today only
 *      PedidosYa Courier is wired; the registry is multi-provider
 *      ready for R101+).
 *   3. Returns the list of payment methods available given the
 *      currently configured payment gateway env vars.
 *
 * Pre-alta fallback · when a courier provider's env vars aren't
 * set yet (CourierEnvError), the route returns a stub quote
 * (`stub: true`) so the UI flow keeps working in dev/preview
 * before business onboarding completes. When the env vars arrive,
 * the same route automatically starts returning real quotes
 * with `stub: false`.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = checkoutQuoteRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }
  const { dropoff, lines } = parsed.data

  const subtotalUsd = computeSubtotalUsd(lines)
  const discount = computeDiscount(subtotalUsd, null)
  const itemCount = totalItemCount(lines)

  const dispatchItems: DispatchItem[] = lines.map((l) => ({
    description: `${l.qty}× ${l.name}`,
    quantity: l.qty,
    priceUsd: l.priceUsd,
  }))

  const providers = getActiveCourierProviders()
  const deliveryOptions: Array<{
    provider_id: string
    provider_label: string
    quote_token: string
    fee_usd: number
    eta_minutes: number
    expires_at: string
    stub: boolean
    error?: string
  }> = []

  for (const provider of providers) {
    try {
      const q = await provider.getQuote({
        dropoff: {
          street: dropoff.street,
          detail: dropoff.detail || null,
          countryCode: dropoff.countryCode ?? "EC",
          latitude: dropoff.latitude,
          longitude: dropoff.longitude,
        },
        items: dispatchItems,
        cartTotalUsd: subtotalUsd,
      })
      deliveryOptions.push({
        provider_id: provider.id,
        provider_label: provider.label,
        quote_token: q.quoteToken,
        fee_usd: q.priceUsd,
        eta_minutes: q.etaMinutes,
        expires_at: q.expiresAt,
        stub: false,
      })
    } catch (err) {
      if (err instanceof CourierEnvError) {
        deliveryOptions.push(stubQuoteFor(provider))
      } else {
        const message = err instanceof Error ? err.message : String(err)
        deliveryOptions.push({
          provider_id: provider.id,
          provider_label: provider.label,
          quote_token: "",
          fee_usd: 0,
          eta_minutes: 0,
          expires_at: new Date().toISOString(),
          stub: false,
          error: message,
        })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    subtotal_usd: subtotalUsd,
    discount,
    item_count: itemCount,
    delivery_options: deliveryOptions,
    payment_methods: availablePaymentMethods(),
    computed_at: new Date().toISOString(),
  })
}

function stubQuoteFor(provider: CourierProvider): {
  provider_id: string
  provider_label: string
  quote_token: string
  fee_usd: number
  eta_minutes: number
  expires_at: string
  stub: true
} {
  const token = `STUB-${provider.id}-${randomBytes(4).toString("hex").toUpperCase()}`
  return {
    provider_id: provider.id,
    provider_label: `${provider.label} (stub · alta pending)`,
    quote_token: token,
    fee_usd: 2.5,
    eta_minutes: 25,
    expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
    stub: true,
  }
}

/**
 * Available payment methods given the configured gateway env vars.
 * Pre-Kushki alta only the offline methods are surfaced; once
 * `KUSHKI_PUBLIC_KEY` lands, the gateway-served methods light up
 * automatically.
 */
function availablePaymentMethods(): PaymentMethod[] {
  const methods: PaymentMethod[] = []
  if (process.env.KUSHKI_PUBLIC_KEY) {
    methods.push(
      "GOOGLE_PAY",
      "APPLE_PAY",
      "CARD_CREDIT",
      "CARD_DEBIT",
    )
  }
  if (process.env.PAYPHONE_TOKEN) methods.push("PAYPHONE")
  // Always available · offline fallbacks
  methods.push("CASH_ON_DELIVERY", "WHATSAPP_MANUAL")
  return methods
}

export function GET() {
  return NextResponse.json({
    endpoint: "/api/checkout/quote",
    method: "POST",
    runtime: "nodejs",
    description:
      "Cotización de checkout · subtotal server-computed + 1 quote por delivery provider activo + payment methods disponibles según gateways configurados.",
    body_shape: {
      dropoff: {
        street: "string (required, max 200)",
        detail: "string (optional, max 200)",
        countryCode: "string (optional · default EC)",
        latitude: "number (optional · decimal degrees)",
        longitude: "number (optional · decimal degrees)",
      },
      lines: "array · [{ id, name, priceUsd, qty }]",
    },
  })
}
