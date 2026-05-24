import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * GET /api/customer/addresses?whatsapp=... · R96.108
 *
 * Devuelve las direcciones guardadas del cliente · libreta multi-address
 * estilo Domino's (Casa · Trabajo · Otra). Schema · naufrago_customers.addresses jsonb.
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
    const { data } = await supa
      .from("naufrago_customers")
      .select("addresses")
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", whatsapp)
      .maybeSingle()
    const addresses = Array.isArray(data?.addresses) ? data!.addresses : []
    return Response.json({ ok: true, addresses })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
