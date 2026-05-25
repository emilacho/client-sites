import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * /api/customer/addresses · R96.108 + R96.119
 *
 * GET ?whatsapp=... (legacy · phone como query) o GET con Bearer token
 *   (preferido · resuelve customer por auth_user_id)
 * PATCH body { addresses: Address[] } · Bearer token · sobreescribe el
 *   array completo · cliente envía la libreta editada.
 *
 * Address shape · { street, detail?, label?, isDefault?, lat?, lng?, country? }
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

async function resolveCustomerByAuth(
  token: string,
): Promise<{ id: string; whatsapp: string | null } | null> {
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  if (!url || !anon) return null
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false },
  })
  const { data: userRes } = await anonClient.auth.getUser(token)
  if (!userRes?.user) return null
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("naufrago_customers")
    .select("id, whatsapp_e164")
    .eq("client_slug", CLIENT_SLUG)
    .eq("auth_user_id", userRes.user.id)
    .maybeSingle()
  if (!data) return null
  return { id: data.id, whatsapp: data.whatsapp_e164 ?? null }
}

export async function GET(req: NextRequest) {
  // Try Bearer first (Supabase Auth)
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (token) {
    const customer = await resolveCustomerByAuth(token)
    if (!customer) {
      return Response.json({ ok: true, addresses: [] })
    }
    const supa = getSupabaseAdmin()
    const { data } = await supa
      .from("naufrago_customers")
      .select("addresses")
      .eq("id", customer.id)
      .maybeSingle()
    const addresses = Array.isArray(data?.addresses) ? data!.addresses : []
    return Response.json({ ok: true, addresses })
  }

  // Legacy fallback · whatsapp query param
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

interface AddressInput {
  street?: unknown
  detail?: unknown
  label?: unknown
  isDefault?: unknown
  lat?: unknown
  lng?: unknown
  country?: unknown
}

function sanitizeAddresses(input: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(input)) return []
  const cleaned: Array<Record<string, unknown>> = []
  let defaultSet = false
  for (const raw of input as AddressInput[]) {
    if (!raw || typeof raw !== "object") continue
    const street = typeof raw.street === "string" ? raw.street.trim() : ""
    if (!street) continue
    const isDefault = raw.isDefault === true && !defaultSet
    if (isDefault) defaultSet = true
    cleaned.push({
      street: street.slice(0, 200),
      detail:
        typeof raw.detail === "string" && raw.detail.trim()
          ? raw.detail.trim().slice(0, 200)
          : null,
      label:
        typeof raw.label === "string" && raw.label.trim()
          ? raw.label.trim().slice(0, 40)
          : "Otra",
      isDefault,
      lat: typeof raw.lat === "number" ? raw.lat : null,
      lng: typeof raw.lng === "number" ? raw.lng : null,
      country: typeof raw.country === "string" ? raw.country.slice(0, 4) : "EC",
    })
    if (cleaned.length >= 10) break // cap por seguridad
  }
  return cleaned
}

export async function PATCH(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) {
    return Response.json({ ok: false, error: "no_auth" }, { status: 401 })
  }
  const customer = await resolveCustomerByAuth(token)
  if (!customer) {
    return Response.json({ ok: false, error: "no_customer" }, { status: 404 })
  }

  let body: { addresses?: unknown }
  try {
    body = (await req.json()) as { addresses?: unknown }
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const addresses = sanitizeAddresses(body.addresses)
  try {
    const supa = getSupabaseAdmin()
    const { error } = await supa
      .from("naufrago_customers")
      .update({ addresses, updated_at: new Date().toISOString() })
      .eq("id", customer.id)
    if (error) {
      return Response.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 },
      )
    }
    return Response.json({ ok: true, addresses })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
