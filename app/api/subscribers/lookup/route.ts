import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * GET /api/subscribers/lookup?whatsapp=... · R96.144
 *
 * Devuelve el estado actual de opt-in promos del cliente para
 * mostrarlo en /mi-cuenta sección Notificaciones.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

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
      .from("subscribers")
      .select("opt_in_promos, opt_in_tracking")
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", whatsapp)
      .maybeSingle()
    return Response.json({
      ok: true,
      opt_in_promos: data?.opt_in_promos ?? false,
      opt_in_tracking: data?.opt_in_tracking ?? false,
    })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
