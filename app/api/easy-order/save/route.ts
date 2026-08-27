import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/easy-order/save · R96.106
 *
 * Llamado post-checkout-success · UPSERT naufrago_customers + naufrago_easy_orders.
 * Best-effort · si falla NO bloquea la confirmación · solo no persiste perfil
 * cross-device.
 *
 * Body · { whatsapp, name?, email?, cart_lines, dropoff?, payment_method?, delivery_provider?, total_usd?, source_order_code? }
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"

function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

interface SaveBody {
  whatsapp?: unknown
  name?: unknown
  email?: unknown
  cart_lines?: unknown
  dropoff?: unknown
  payment_method?: unknown
  delivery_provider?: unknown
  total_usd?: unknown
  source_order_code?: unknown
}

export async function POST(req: NextRequest) {
  let body: SaveBody
  try {
    body = (await req.json()) as SaveBody
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const whatsappRaw = typeof body.whatsapp === "string" ? body.whatsapp : ""
  const whatsapp = whatsappRaw ? normalizeWhatsapp(whatsappRaw) : null
  if (!whatsapp) {
    return Response.json({ ok: false, error: "invalid_whatsapp" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : null
  const email = typeof body.email === "string" ? body.email.trim() : null
  const cartLines = Array.isArray(body.cart_lines) ? body.cart_lines : null
  const dropoff =
    body.dropoff && typeof body.dropoff === "object" ? body.dropoff : null
  const paymentMethod =
    typeof body.payment_method === "string" ? body.payment_method : null
  const deliveryProvider =
    typeof body.delivery_provider === "string" ? body.delivery_provider : null
  const totalUsd =
    typeof body.total_usd === "number" ? body.total_usd : null
  const sourceOrderCode =
    typeof body.source_order_code === "string" ? body.source_order_code : null

  if (!cartLines || cartLines.length === 0) {
    return Response.json({ ok: false, error: "empty_cart" }, { status: 400 })
  }

  try {
    const supa = getSupabaseAdmin()

    // 1) UPSERT customer · bump total_orders + total_spend_usd.
    const { data: existing } = await supa
      .from("customers")
      .select("id, addresses, total_orders, total_spend_usd, first_order_at, name, email")
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", whatsapp)
      .maybeSingle()

    const prevAddresses: Array<{ street: string }> = Array.isArray(
      existing?.addresses,
    )
      ? (existing!.addresses as Array<{ street: string }>)
      : []
    let nextAddresses = prevAddresses
    if (dropoff && typeof (dropoff as { street?: unknown }).street === "string") {
      const d = dropoff as { street: string; detail?: unknown; latitude?: unknown; longitude?: unknown; countryCode?: unknown }
      const hasAddress = prevAddresses.some((a) => a.street === d.street)
      if (!hasAddress) {
        nextAddresses = [
          ...prevAddresses,
          {
            street: d.street,
            detail: typeof d.detail === "string" ? d.detail : null,
            lat: typeof d.latitude === "number" ? d.latitude : null,
            lng: typeof d.longitude === "number" ? d.longitude : null,
            country: typeof d.countryCode === "string" ? d.countryCode : "EC",
          } as { street: string },
        ]
      }
    }

    const upsertPayload = {
      client_slug: CLIENT_SLUG,
      whatsapp_e164: whatsapp,
      name: name ?? existing?.name ?? null,
      email: email ?? existing?.email ?? null,
      addresses: nextAddresses,
      total_orders: (existing?.total_orders ?? 0) + 1,
      total_spend_usd:
        Number(existing?.total_spend_usd ?? 0) + Number(totalUsd ?? 0),
      first_order_at: existing?.first_order_at ?? new Date().toISOString(),
      last_order_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    const { data: upserted, error: upsertErr } = await supa
      .from("customers")
      .upsert(upsertPayload, { onConflict: "client_slug,whatsapp_e164" })
      .select("id")
      .maybeSingle()

    if (upsertErr) {
      return Response.json(
        { ok: false, error: "db_customer", detail: upsertErr.message },
        { status: 500 },
      )
    }

    const customerId = upserted?.id ?? existing?.id
    if (!customerId) {
      return Response.json({ ok: false, error: "no_customer_id" }, { status: 500 })
    }

    // 2) UPSERT easy_order · 1 por cliente · overwrite.
    const { error: eoErr } = await supa.from("easy_orders").upsert(
      {
        client_slug: CLIENT_SLUG,
        customer_id: customerId,
        whatsapp_e164: whatsapp,
        nickname: "Hambre de Náufrago",
        cart_lines: cartLines,
        dropoff,
        payment_method: paymentMethod,
        delivery_provider: deliveryProvider,
        total_usd: totalUsd,
        source_order_code: sourceOrderCode,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "client_slug,customer_id" },
    )

    if (eoErr) {
      return Response.json(
        { ok: false, error: "db_easy_order", detail: eoErr.message },
        { status: 500 },
      )
    }

    return Response.json({ ok: true, customerId })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
