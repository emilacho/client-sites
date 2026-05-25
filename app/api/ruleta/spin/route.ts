import type { NextRequest } from "next/server"
import { createHash } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * POST /api/ruleta/spin · R96.98 · cofre ruleta · 1 spin por
 * IP/fingerprint cada 24h. Premios ponderados ·
 *   - chifle gratis  · 30%
 *   - pan gratis     · 25%
 *   - cola gratis    · 20%
 *   - siga participando · 25%
 *
 * Body · { fingerprint: string }
 * Response · success → { ok: true, prize, prizeIndex }
 *            cooldown → { ok: false, alreadyPlayed: true, lastPrize, hoursUntilNext }
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const COOLDOWN_HOURS = 24
const IP_SALT = process.env.RULETA_IP_SALT ?? "naufrago-ruleta-2026"

interface SpinBody {
  fingerprint?: unknown
}

interface Prize {
  key: "chifle" | "pan" | "cola" | "siga"
  label: string
  weight: number
}

const PRIZES: Prize[] = [
  { key: "chifle", label: "Chifle gratis", weight: 30 },
  { key: "pan", label: "Pan gratis", weight: 25 },
  { key: "cola", label: "Cola gratis", weight: 20 },
  { key: "siga", label: "Siga participando", weight: 25 },
]

function pickPrize(): { prize: Prize; index: number } {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0)
  let roll = Math.random() * total
  for (let i = 0; i < PRIZES.length; i++) {
    roll -= PRIZES[i].weight
    if (roll <= 0) return { prize: PRIZES[i], index: i }
  }
  return { prize: PRIZES[PRIZES.length - 1], index: PRIZES.length - 1 }
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_SALT}|${ip}`).digest("hex")
}

export async function POST(req: NextRequest) {
  // R96.132 · rate limit · 5 spins/min/IP (cooldown server-side de 24h
  // ya gobierna · este rate limit previene DOS-attacks contra DB).
  const ipForRl = getClientIp(req)
  const rl = await checkRateLimit(ipForRl, {
    limit: 5,
    windowSec: 60,
    bucket: "ruleta_spin",
  })
  if (!rl.ok) {
    return Response.json(
      { ok: false, error: "rate_limited", retryIn: rl.resetIn },
      { status: 429 },
    )
  }

  let body: SpinBody = {}
  try {
    body = (await req.json()) as SpinBody
  } catch {
    // body opcional · fingerprint puede venir vacío
  }

  const fingerprint =
    typeof body.fingerprint === "string" ? body.fingerprint.slice(0, 128) : null

  const ip = getClientIp(req)
  const ipHash = ip !== "unknown" ? hashIp(ip) : null

  if (!fingerprint && !ipHash) {
    return Response.json(
      { ok: false, error: "no_identifier" },
      { status: 400 },
    )
  }

  try {
    const supa = getSupabaseAdmin()
    const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600_000).toISOString()

    // Check cooldown · cualquier spin reciente bajo IP o fingerprint.
    let query = supa
      .from("naufrago_ruleta_spins")
      .select("prize, spun_at")
      .eq("client_slug", CLIENT_SLUG)
      .gte("spun_at", cutoff)
      .order("spun_at", { ascending: false })
      .limit(1)

    const filters: string[] = []
    if (ipHash) filters.push(`ip_hash.eq.${ipHash}`)
    if (fingerprint) filters.push(`fingerprint.eq.${fingerprint}`)
    if (filters.length > 0) {
      query = query.or(filters.join(","))
    }

    const { data: recent, error: selectErr } = await query
    if (selectErr) {
      return Response.json(
        { ok: false, error: "db_select_error", detail: selectErr.message },
        { status: 500 },
      )
    }

    if (recent && recent.length > 0) {
      const last = recent[0]
      const lastDate = new Date(last.spun_at).getTime()
      const hoursElapsed = (Date.now() - lastDate) / 3600_000
      const hoursUntilNext = Math.max(
        0,
        Math.ceil(COOLDOWN_HOURS - hoursElapsed),
      )
      return Response.json({
        ok: false,
        alreadyPlayed: true,
        lastPrize: last.prize,
        hoursUntilNext,
      })
    }

    // Pick + persist new spin.
    const { prize, index } = pickPrize()
    const { error: insertErr } = await supa
      .from("naufrago_ruleta_spins")
      .insert({
        client_slug: CLIENT_SLUG,
        fingerprint,
        ip_hash: ipHash,
        prize: prize.label,
        prize_index: index,
      })

    if (insertErr) {
      return Response.json(
        { ok: false, error: "db_insert_error", detail: insertErr.message },
        { status: 500 },
      )
    }

    return Response.json({
      ok: true,
      prize: prize.label,
      prizeKey: prize.key,
      prizeIndex: index,
    })
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
