import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHash, randomInt } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/customer/change-whatsapp-request · R96.119
 *
 * Step 1 del flow de cambio de WhatsApp · valida que el nuevo número
 * NO esté tomado por otro customer · genera OTP · envía al NUEVO
 * número via Twilio. El cliente debe responder con el código para
 * confirmar (step 2 endpoint).
 *
 * Body · { newWhatsapp }
 * Auth · Bearer access_token Supabase
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const PURPOSE = "change_whatsapp"
const TTL_MIN = 5
const OTP_SALT = process.env.OTP_SALT ?? "naufrago-otp-2026"

function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

function hashCode(code: string): string {
  return createHash("sha256").update(`${OTP_SALT}|${code}`).digest("hex")
}

async function resolveCustomer(token: string): Promise<{ id: string; currentWhatsapp: string | null } | null> {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  if (!url || !anon) return null
  const anonClient = createClient(url, anon, { auth: { persistSession: false } })
  const { data: userRes } = await anonClient.auth.getUser(token)
  if (!userRes?.user) return null
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("customers")
    .select("id, whatsapp_e164")
    .eq("client_slug", CLIENT_SLUG)
    .eq("auth_user_id", userRes.user.id)
    .maybeSingle()
  if (!data) return null
  return { id: data.id, currentWhatsapp: data.whatsapp_e164 ?? null }
}

async function sendOtpWhatsApp(phone: string, code: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWa = process.env.TWILIO_WHATSAPP_FROM
  if (!accountSid || !authToken || !fromWa) return false
  const message = `Tu código Náufrago · ${code}\n\nValido por 5 min · confirmá el cambio de WhatsApp en tu cuenta.`
  const params = new URLSearchParams({
    To: `whatsapp:+${phone}`,
    From: fromWa,
    Body: message,
  })
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64")
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    },
  )
  return res.ok
}

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) {
    return Response.json({ ok: false, error: "no_auth" }, { status: 401 })
  }
  const customer = await resolveCustomer(token)
  if (!customer) {
    return Response.json({ ok: false, error: "no_customer" }, { status: 404 })
  }

  let body: { newWhatsapp?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  const newPhone = normalizeE164(
    typeof body.newWhatsapp === "string" ? body.newWhatsapp : "",
  )
  if (!newPhone) {
    return Response.json({ ok: false, error: "invalid_whatsapp" }, { status: 400 })
  }
  if (newPhone === customer.currentWhatsapp) {
    return Response.json({ ok: false, error: "same_as_current" })
  }

  try {
    const supa = getSupabaseAdmin()
    // Conflict check · el nuevo no debe pertenecer a otro customer.
    const { data: takenBy } = await supa
      .from("customers")
      .select("id")
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", newPhone)
      .neq("id", customer.id)
      .maybeSingle()
    if (takenBy) {
      return Response.json({ ok: false, error: "whatsapp_taken" })
    }

    const code = String(randomInt(0, 10000)).padStart(4, "0")
    const codeHash = hashCode(code)
    const expiresAt = new Date(Date.now() + TTL_MIN * 60_000).toISOString()
    await supa.from("otp_codes").insert({
      client_slug: CLIENT_SLUG,
      phone_e164: newPhone,
      purpose: PURPOSE,
      code_hash: codeHash,
      expires_at: expiresAt,
    })
    const sent = await sendOtpWhatsApp(newPhone, code)
    return Response.json({
      ok: true,
      expiresAt,
      sent,
      ...(sent ? {} : { reason: "twilio_not_configured" }),
    })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
