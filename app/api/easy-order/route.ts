import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * GET /api/easy-order?whatsapp=... · R96.106
 *
 * Devuelve el Easy Order ("Hambre de Náufrago") del cliente · 1 por
 * whatsapp. Cross-device · sirve el último pedido confirmado como
 * orden re-ordenable.
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

export async function GET(req: NextRequest) {
  const whatsappRaw = req.nextUrl.searchParams.get("whatsapp")
  if (!whatsappRaw) {
    return Response.json({ ok: false, error: "missing_whatsapp" }, { status: 400 })
  }
  const whatsapp = normalizeWhatsapp(whatsappRaw)
  if (!whatsapp) {
    return Response.json({ ok: false, error: "invalid_whatsapp" }, { status: 400 })
  }

  try {
    const supa = getSupabaseAdmin()
    const { data, error } = await supa
      .from("easy_orders")
      .select(
        "nickname, cart_lines, dropoff, payment_method, delivery_provider, total_usd, source_order_code, updated_at",
      )
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", whatsapp)
      .maybeSingle()
    if (error) {
      return Response.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 },
      )
    }
    if (!data) {
      return Response.json({ ok: true, easyOrder: null })
    }
    return Response.json({ ok: true, easyOrder: data })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
