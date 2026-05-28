import type { NextRequest } from "next/server"
import { createHash } from "node:crypto"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/consent · R96.129 · LOPDP Ecuador art. 24
 *
 * Registra consents del cliente · cookies · marketing · tracking · etc.
 * Body · { consent_type, accepted, url? }
 * Auth · Bearer opcional (si hay sesión · asocia al customer_id).
 *   Sin sesión · solo se loggea con ip_hash (anonymous consent).
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const IP_SALT = process.env.CONSENT_IP_SALT ?? "naufrago-consent-2026"

function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")
  if (fwd) return fwd.split(",")[0].trim()
  const real = req.headers.get("x-real-ip")
  if (real) return real.trim()
  return "unknown"
}

function hashIp(ip: string): string {
  return createHash("sha256").update(`${IP_SALT}|${ip}`).digest("hex")
}

async function resolveCustomerId(token: string | null): Promise<string | null> {
  if (!token) return null
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  if (!url || !anon) return null
  try {
    const anonClient = createClient(url, anon, {
      auth: { persistSession: false },
    })
    const { data: userRes } = await anonClient.auth.getUser(token)
    if (!userRes?.user) return null
    const supa = getSupabaseAdmin()
    const { data } = await supa
      .from("customers")
      .select("id")
      .eq("client_slug", CLIENT_SLUG)
      .eq("auth_user_id", userRes.user.id)
      .maybeSingle()
    return data?.id ?? null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  let body: { consent_type?: unknown; accepted?: unknown; url?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const consentType =
    typeof body.consent_type === "string" ? body.consent_type.slice(0, 60) : ""
  const accepted = body.accepted === true
  const url = typeof body.url === "string" ? body.url.slice(0, 500) : null
  if (!consentType) {
    return Response.json(
      { ok: false, error: "missing_consent_type" },
      { status: 400 },
    )
  }

  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  const customerId = await resolveCustomerId(token)
  const ip = getClientIp(req)
  const ipHash = ip !== "unknown" ? hashIp(ip) : null
  const userAgent = req.headers.get("user-agent")?.slice(0, 300) ?? null

  try {
    const supa = getSupabaseAdmin()
    const { error } = await supa.from("consent_log").insert({
      client_slug: CLIENT_SLUG,
      customer_id: customerId,
      consent_type: consentType,
      accepted,
      ip_hash: ipHash,
      user_agent: userAgent,
      url,
    })
    if (error) {
      return Response.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 },
      )
    }
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
