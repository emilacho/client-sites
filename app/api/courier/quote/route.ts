import { NextResponse } from "next/server"
import { courierQuoteRequestSchema } from "@/lib/schemas"
import { getDeliveryQuote } from "@/lib/courier/pedidosya-client"

export const runtime = "nodejs"

/**
 * Round 74 · PedidosYa Courier · quote endpoint.
 *
 *   POST /api/courier/quote
 *     body  · { dropoff: { street, detail?, latitude?, longitude? },
 *               lines:   [{ id, name, priceUsd, qty }] }
 *     resp  · { ok: true, quoteToken, priceUsd, etaMinutes, expiresAt }
 *
 * The cart lines arrive verbatim from the client so they can be
 * displayed back in the confirmation step · we pass them to
 * PedidosYa as a single line item (description = "Náufrago · N
 * items", priceUsd = cart total) which is the conventional way
 * to estimate the rider for a multi-line food order.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = courierQuoteRequestSchema.safeParse(body)
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
  const cartTotalUsd = lines.reduce(
    (sum, l) => sum + l.priceUsd * l.qty,
    0,
  )
  const itemCount = lines.reduce((sum, l) => sum + l.qty, 0)

  try {
    const quote = await getDeliveryQuote({
      dropoff,
      cartTotalUsd,
      itemCount,
    })
    return NextResponse.json({
      ok: true,
      quoteToken: quote.quoteToken,
      priceUsd: quote.priceUsd,
      etaMinutes: quote.etaMinutes,
      expiresAt: quote.expiresAt,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // courier_env_missing:* → 503 (mis-configured server)
    // courier_token_failed:*, courier_quote_failed:* → 502
    const status = message.startsWith("courier_env_missing:") ? 503 : 502
    return NextResponse.json({ error: "quote_failed", detail: message }, { status })
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/courier/quote",
    method: "POST",
    runtime: "nodejs",
    description: "PedidosYa Courier · cotización de envío",
    body_shape: {
      dropoff: {
        street: "string (required, max 200)",
        detail: "string (optional, max 200)",
        countryCode: "string (optional · default env PEDIDOSYA_COURIER_COUNTRY_CODE)",
        latitude: "number (optional · decimal degrees)",
        longitude: "number (optional · decimal degrees)",
      },
      lines: "array · [{ id, name, priceUsd, qty }]",
    },
  })
}
