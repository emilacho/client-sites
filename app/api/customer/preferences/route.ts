import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * /api/customer/preferences · R96.109
 *
 * GET ?whatsapp=... → { preferences: string | null }
 * POST { whatsapp, preferences } → { ok: true }
 *
 * Notas/preferencias persistentes del cliente. Pre-fill en cart notes
 * de futuros pedidos (estilo Pizza Profile favorite-toppings).
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const MAX_LEN = 500

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
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("naufrago_customers")
    .select("preferences")
    .eq("client_slug", CLIENT_SLUG)
    .eq("whatsapp_e164", whatsapp)
    .maybeSingle()
  return Response.json({ ok: true, preferences: data?.preferences ?? null })
}

export async function POST(req: NextRequest) {
  let body: { whatsapp?: unknown; preferences?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  const whatsappRaw = typeof body.whatsapp === "string" ? body.whatsapp : ""
  const whatsapp = normalizeWhatsapp(whatsappRaw)
  if (!whatsapp) {
    return Response.json({ ok: false, error: "invalid_whatsapp" }, { status: 400 })
  }
  const pref =
    typeof body.preferences === "string"
      ? body.preferences.trim().slice(0, MAX_LEN)
      : null
  const supa = getSupabaseAdmin()
  const { error } = await supa
    .from("naufrago_customers")
    .update({ preferences: pref })
    .eq("client_slug", CLIENT_SLUG)
    .eq("whatsapp_e164", whatsapp)
  if (error) {
    return Response.json(
      { ok: false, error: "db_error", detail: error.message },
      { status: 500 },
    )
  }
  return Response.json({ ok: true })
}
