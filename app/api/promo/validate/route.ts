import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/promo/validate · R96.105
 *
 * Verifica si un cliente puede usar un código promo · 2 reglas ·
 *   (1) Han pasado >= 24h desde el último uso
 *   (2) Ha acumulado >= $25 en pedidos confirmados desde el último uso
 * El primer uso es libre (sin row en naufrago_promo_usage).
 *
 * Body · { code, whatsapp?, subtotalUsd? }
 * Response ·
 *   { ok: true } → puede aplicar
 *   { ok: false, reason: "cooldown"|"need_spend"|"unknown_code", hoursLeft?, spendNeededUsd? }
 *   { ok: false, needsWhatsapp: true } → falta whatsapp en el request
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const COOLDOWN_HOURS = 24
const QUALIFYING_SPEND_USD = 25

const VALID_CODES = new Set(["SURFBOLLADO"])

interface ValidateBody {
  code?: unknown
  whatsapp?: unknown
}

function normalizeWhatsapp(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

export async function POST(req: NextRequest) {
  let body: ValidateBody
  try {
    body = (await req.json()) as ValidateBody
  } catch {
    return Response.json({ ok: false, reason: "invalid_json" }, { status: 400 })
  }

  const codeRaw = typeof body.code === "string" ? body.code.trim() : ""
  const code = codeRaw.toUpperCase()
  if (!code || !VALID_CODES.has(code)) {
    return Response.json({ ok: false, reason: "unknown_code" })
  }

  const whatsappRaw =
    typeof body.whatsapp === "string" ? body.whatsapp.trim() : ""
  if (!whatsappRaw) {
    return Response.json({ ok: false, needsWhatsapp: true })
  }
  const whatsapp = normalizeWhatsapp(whatsappRaw)
  if (!whatsapp) {
    return Response.json({ ok: false, reason: "invalid_whatsapp" })
  }

  try {
    const supa = getSupabaseAdmin()
    const { data: rows, error } = await supa
      .from("naufrago_promo_usage")
      .select("last_used_at, qualifying_spend_since_last_use")
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", whatsapp)
      .eq("code", code)
      .limit(1)

    if (error) {
      return Response.json(
        { ok: false, reason: "db_error", detail: error.message },
        { status: 500 },
      )
    }

    if (!rows || rows.length === 0) {
      // Primer uso · libre.
      return Response.json({ ok: true, firstUse: true, whatsapp })
    }

    const row = rows[0]
    const lastUsedAt = new Date(row.last_used_at).getTime()
    const ageHours = (Date.now() - lastUsedAt) / 3600_000
    const spend = Number(row.qualifying_spend_since_last_use ?? 0)

    if (ageHours < COOLDOWN_HOURS) {
      return Response.json({
        ok: false,
        reason: "cooldown",
        hoursLeft: Math.max(1, Math.ceil(COOLDOWN_HOURS - ageHours)),
        spendUsd: spend,
        spendNeededUsd: Math.max(0, QUALIFYING_SPEND_USD - spend),
      })
    }
    if (spend < QUALIFYING_SPEND_USD) {
      return Response.json({
        ok: false,
        reason: "need_spend",
        spendUsd: spend,
        spendNeededUsd: Math.round((QUALIFYING_SPEND_USD - spend) * 100) / 100,
      })
    }
    return Response.json({ ok: true, whatsapp })
  } catch (err) {
    return Response.json(
      { ok: false, reason: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
