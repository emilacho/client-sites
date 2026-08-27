import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/subscribers/signup · R96.10 · lite opt-in.
 *
 * Body · { name, whatsapp, email?, optInPromos, optInTracking, source? }
 * Idempotent · UPSERT por (client_slug, whatsapp_e164).
 *
 * Normaliza WhatsApp · strip non-digits + ensure starts con código país
 * (asume EC 593 si empieza con 0 o no tiene código país).
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"

interface SignupBody {
  name?: unknown
  whatsapp?: unknown
  email?: unknown
  optInPromos?: unknown
  optInTracking?: unknown
  source?: unknown
}

function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  // EC default · si arranca con 0 (formato local "0997...") · reemplazo
  // con 593. Si arranca con 593 · ya está. Otros casos · respeto digits.
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

export async function POST(req: NextRequest) {
  let body: SignupBody
  try {
    body = (await req.json()) as SignupBody
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const name = typeof body.name === "string" ? body.name.trim() : ""
  const whatsappRaw = typeof body.whatsapp === "string" ? body.whatsapp.trim() : ""
  const emailRaw = typeof body.email === "string" ? body.email.trim() : ""
  const optInPromos = body.optInPromos === true
  const optInTracking = body.optInTracking === true
  const source = typeof body.source === "string" ? body.source.slice(0, 60) : null

  if (name.length < 2 || name.length > 80) {
    return Response.json({ ok: false, error: "invalid_name" }, { status: 400 })
  }
  const whatsapp = normalizeWhatsapp(whatsappRaw)
  if (!whatsapp) {
    return Response.json({ ok: false, error: "invalid_whatsapp" }, { status: 400 })
  }
  const email = emailRaw && isEmail(emailRaw) ? emailRaw.toLowerCase() : null
  if (emailRaw && !email) {
    return Response.json({ ok: false, error: "invalid_email" }, { status: 400 })
  }
  if (!optInPromos && !optInTracking) {
    return Response.json(
      { ok: false, error: "no_opt_in" },
      { status: 400 },
    )
  }

  try {
    const supa = getSupabaseAdmin()
    const { error } = await supa
      .from("subscribers")
      .upsert(
        {
          client_slug: CLIENT_SLUG,
          whatsapp_e164: whatsapp,
          name,
          email,
          opt_in_promos: optInPromos,
          opt_in_tracking: optInTracking,
          source,
        },
        { onConflict: "client_slug,whatsapp_e164" },
      )
    if (error) {
      return Response.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 },
      )
    }
    return Response.json({ ok: true, whatsapp })
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown_error",
      },
      { status: 500 },
    )
  }
}
