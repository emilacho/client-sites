import type { NextRequest } from "next/server"
import { createHash, randomInt } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * POST /api/loyalty/redeem-request · R96.111
 *
 * Step-up auth para canje de perlas. Genera 4-digit OTP · stored hashed ·
 * envía vía WhatsApp Twilio. Expira 5 min · max 3 attempts.
 *
 * Body · { whatsapp, rewardId, perlasToSpend? }
 * Response · { ok, expiresAt }
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const PURPOSE = "loyalty_redeem"
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

async function sendOtpWhatsApp(phone: string, code: string): Promise<boolean> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromWa = process.env.TWILIO_WHATSAPP_FROM
  if (!accountSid || !authToken || !fromWa) return false
  const message = `Tu código Náufrago · ${code}\n\nVálido por 5 min · NO lo compartas. Úsalo para canjear tu tesoro de náufrago.`
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
  // R96.132 · rate limit · 3 OTP requests/5min/IP (anti-spam Twilio cost).
  const ipForRl = getClientIp(req)
  const rl = await checkRateLimit(ipForRl, {
    limit: 3,
    windowSec: 300,
    bucket: "otp_redeem_request",
  })
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "rate_limited", retryIn: rl.resetIn },
      { status: 429 },
    )
  }

  let body: { whatsapp?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  const whatsappRaw = typeof body.whatsapp === "string" ? body.whatsapp : ""
  const phone = normalizeE164(whatsappRaw)
  if (!phone) {
    return Response.json({ ok: false, error: "invalid_whatsapp" }, { status: 400 })
  }

  try {
    const supa = getSupabaseAdmin()
    const code = String(randomInt(0, 10000)).padStart(4, "0")
    const codeHash = hashCode(code)
    const expiresAt = new Date(Date.now() + TTL_MIN * 60_000).toISOString()

    const { error: insertErr } = await supa.from("otp_codes").insert({
      client_slug: CLIENT_SLUG,
      phone_e164: phone,
      purpose: PURPOSE,
      code_hash: codeHash,
      expires_at: expiresAt,
    })
    if (insertErr) {
      return Response.json(
        { ok: false, error: "db_error", detail: insertErr.message },
        { status: 500 },
      )
    }

    const sent = await sendOtpWhatsApp(phone, code)
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
