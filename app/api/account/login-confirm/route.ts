import type { NextRequest } from "next/server"
import { createHash } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase"
import { signSession, buildCookieValue } from "@/lib/account-session"

/**
 * POST /api/account/login-confirm · R96.112
 *
 * Valida OTP de cross-device login · si OK setea cookie firmada
 * `naufrago_session` HTTP-only 90 días.
 *
 * Body · { whatsapp, code }
 * Response · { ok: true } + Set-Cookie
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const PURPOSE = "account_login"
const MAX_ATTEMPTS = 3
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

export async function POST(req: NextRequest) {
  let body: { whatsapp?: unknown; code?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, reason: "invalid_json" }, { status: 400 })
  }
  const phone = normalizeE164(
    typeof body.whatsapp === "string" ? body.whatsapp : "",
  )
  if (!phone) {
    return Response.json({ ok: false, reason: "invalid_whatsapp" }, { status: 400 })
  }
  const codeRaw = typeof body.code === "string" ? body.code.trim() : ""
  if (!/^\d{4}$/.test(codeRaw)) {
    return Response.json({ ok: false, reason: "invalid_code" })
  }
  try {
    const supa = getSupabaseAdmin()
    const { data: rows } = await supa
      .from("otp_codes")
      .select("id, code_hash, attempts, consumed_at, expires_at")
      .eq("client_slug", CLIENT_SLUG)
      .eq("phone_e164", phone)
      .eq("purpose", PURPOSE)
      .order("created_at", { ascending: false })
      .limit(1)
    if (!rows || rows.length === 0) {
      return Response.json({ ok: false, reason: "no_active_code" })
    }
    const row = rows[0]
    if (row.consumed_at) {
      return Response.json({ ok: false, reason: "already_consumed" })
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      return Response.json({ ok: false, reason: "expired" })
    }
    if ((row.attempts ?? 0) >= MAX_ATTEMPTS) {
      return Response.json({ ok: false, reason: "too_many_attempts" })
    }
    if (row.code_hash !== hashCode(codeRaw)) {
      await supa
        .from("otp_codes")
        .update({ attempts: (row.attempts ?? 0) + 1 })
        .eq("id", row.id)
      return Response.json({
        ok: false,
        reason: "wrong_code",
        attemptsLeft: MAX_ATTEMPTS - ((row.attempts ?? 0) + 1),
      })
    }
    await supa
      .from("otp_codes")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id)

    const token = signSession({ whatsapp: phone })
    return Response.json(
      { ok: true, whatsapp: phone },
      {
        headers: {
          "Set-Cookie": buildCookieValue(token),
        },
      },
    )
  } catch (err) {
    return Response.json(
      { ok: false, reason: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
