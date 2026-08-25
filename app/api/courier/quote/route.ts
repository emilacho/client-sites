import { NextResponse } from "next/server"
import { courierQuoteRequestSchema } from "@/lib/schemas"
import { getDeliveryQuote } from "@/lib/courier/para-rutas"

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

    // R106 · fuera de zona NO es una falla nuestra: es la respuesta
    // correcta de PedidosYa cuando la dirección queda fuera de su
    // cobertura. Antes se le mostraba al cliente el texto crudo
    // `courier_shape_error:quote_400:{"code":"WAYPOINTS_OUT_OF_ZONE"…}`.
    // Es el caso que más se va a ver, porque la página ya no promete
    // zona · el cliente pone su dirección y acá se entera.
    if (message.includes("WAYPOINTS_OUT_OF_ZONE")) {
      return NextResponse.json(
        {
          error: "out_of_zone",
          message:
            "No llegamos con motorizado hasta esa dirección. Probá otra, o escribinos por WhatsApp y vemos cómo hacerte llegar el pedido.",
        },
        { status: 422 },
      )
    }

    // R108 · proveedor no implementado → 501 · es "todavía no existe",
    // no "falló". courier_env_missing:* → 503 (falta configurar el
    // servidor) · el resto → 502 (respuesta inesperada del proveedor).
    const status = message.startsWith("courier_provider_not_implemented:")
      ? 501
      : message.startsWith("courier_env_missing:")
        ? 503
        : 502
    return NextResponse.json(
      {
        error: "quote_failed",
        message:
          "No pudimos calcular el envío en este momento. Probá de nuevo en un minuto o escribinos por WhatsApp.",
        detail: message,
      },
      { status },
    )
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
