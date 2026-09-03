import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHash } from "node:crypto"
import { getSupabaseAdmin } from "@/lib/supabase"
import { telefonoCanonico } from "@/lib/telefono"

/**
 * POST /api/customer/change-whatsapp-confirm · R96.119
 *
 * Step 2 · valida OTP enviado al nuevo número · si OK ·
 *   1) Update naufrago_customers.whatsapp_e164 al nuevo
 *   2) Transferir naufrago_loyalty_balance del viejo al nuevo
 *      (si el nuevo ya tenía row · sumar perlas + earned + spent)
 *   3) Re-asignar naufrago_orders.customer_phone del viejo al nuevo
 *   4) Re-asignar naufrago_easy_orders.whatsapp_e164 al nuevo
 *
 * Body · { newWhatsapp, code }
 * Auth · Bearer access_token Supabase
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const PURPOSE = "change_whatsapp"
const MAX_ATTEMPTS = 3
const OTP_SALT = process.env.OTP_SALT ?? "naufrago-otp-2026"


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

  let body: { newWhatsapp?: unknown; code?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  const newPhone = telefonoCanonico(
    typeof body.newWhatsapp === "string" ? body.newWhatsapp : "",
  )
  if (!newPhone) {
    return Response.json({ ok: false, error: "invalid_whatsapp" }, { status: 400 })
  }
  const codeRaw = typeof body.code === "string" ? body.code.trim() : ""
  if (!/^\d{4}$/.test(codeRaw)) {
    return Response.json({ ok: false, error: "invalid_code" })
  }

  try {
    const supa = getSupabaseAdmin()

    // 1) Validar OTP.
    const { data: rows } = await supa
      .from("otp_codes")
      .select("id, code_hash, attempts, consumed_at, expires_at")
      .eq("client_slug", CLIENT_SLUG)
      .eq("phone_e164", newPhone)
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

    const old = customer.currentWhatsapp

    // 2) Re-check conflict en transaction time.
    const { data: takenBy } = await supa
      .from("customers")
      .select("id")
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", newPhone)
      .neq("id", customer.id)
      .maybeSingle()
    if (takenBy) {
      return Response.json({ ok: false, reason: "whatsapp_taken" })
    }

    // 3) Transferir loyalty balance (si old existe).
    if (old) {
      const { data: oldBalance } = await supa
        .from("loyalty_balance")
        .select("perlas, earned_total, spent_total")
        .eq("client_slug", CLIENT_SLUG)
        .eq("phone", old)
        .maybeSingle()
      if (oldBalance) {
        const { data: newBalance } = await supa
          .from("loyalty_balance")
          .select("perlas, earned_total, spent_total")
          .eq("client_slug", CLIENT_SLUG)
          .eq("phone", newPhone)
          .maybeSingle()
        const mergedPerlas =
          Number(oldBalance.perlas ?? 0) + Number(newBalance?.perlas ?? 0)
        const mergedEarned =
          Number(oldBalance.earned_total ?? 0) +
          Number(newBalance?.earned_total ?? 0)
        const mergedSpent =
          Number(oldBalance.spent_total ?? 0) +
          Number(newBalance?.spent_total ?? 0)
        await supa.from("loyalty_balance").upsert(
          {
            client_slug: CLIENT_SLUG,
            phone: newPhone,
            perlas: mergedPerlas,
            earned_total: mergedEarned,
            spent_total: mergedSpent,
          },
          { onConflict: "client_slug,phone" },
        )
        await supa
          .from("loyalty_balance")
          .delete()
          .eq("client_slug", CLIENT_SLUG)
          .eq("phone", old)
      }

      // 4) Re-asignar orders + easy_orders.
      await supa
        .from("orders")
        .update({ customer_phone: newPhone })
        .eq("client_slug", CLIENT_SLUG)
        .eq("customer_phone", old)
      await supa
        .from("easy_orders")
        .update({ whatsapp_e164: newPhone })
        .eq("client_slug", CLIENT_SLUG)
        .eq("whatsapp_e164", old)
    }

    // 5) Finalmente · update customer.whatsapp_e164.
    const { error: custErr } = await supa
      .from("customers")
      .update({
        whatsapp_e164: newPhone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id)
    if (custErr) {
      return Response.json(
        { ok: false, error: "db_error", detail: custErr.message },
        { status: 500 },
      )
    }
    return Response.json({ ok: true, whatsapp: newPhone })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
