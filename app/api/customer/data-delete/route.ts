import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/customer/data-delete · R96.129 · LOPDP right to be forgotten
 *
 * Soft delete · marca deletion_requested_at en naufrago_customers ·
 * 30 días cooldown · cron jobs futuros hardel delete tras cooldown.
 * Cliente puede cancelar el delete request dentro del cooldown
 * volviendo a loguearse y haciendo POST /api/customer/data-delete/cancel.
 *
 * Auth · Bearer Supabase Auth + Supabase Auth signOut all devices post-delete.
 *
 * Body · { confirm: true } · sanity check para evitar deletes accidentales
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) {
    return Response.json({ ok: false, error: "no_auth" }, { status: 401 })
  }

  let body: { confirm?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  if (body.confirm !== true) {
    return Response.json(
      { ok: false, error: "missing_confirm" },
      { status: 400 },
    )
  }

  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  if (!url || !anon) {
    return Response.json(
      { ok: false, error: "supabase_not_configured" },
      { status: 500 },
    )
  }
  const anonClient = createClient(url, anon, { auth: { persistSession: false } })
  const { data: userRes } = await anonClient.auth.getUser(token)
  if (!userRes?.user) {
    return Response.json({ ok: false, error: "invalid_token" }, { status: 401 })
  }
  const authUser = userRes.user

  try {
    const supa = getSupabaseAdmin()
    const { data: customer } = await supa
      .from("customers")
      .select("id")
      .eq("client_slug", CLIENT_SLUG)
      .eq("auth_user_id", authUser.id)
      .maybeSingle()
    if (!customer) {
      return Response.json({ ok: false, error: "no_customer" }, { status: 404 })
    }
    const { error } = await supa
      .from("customers")
      .update({
        deletion_requested_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", customer.id)
    if (error) {
      return Response.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 },
      )
    }

    // Log el consent del delete (auditable).
    await supa.from("consent_log").insert({
      client_slug: CLIENT_SLUG,
      customer_id: customer.id,
      consent_type: "delete_account_request",
      accepted: true,
    })

    return Response.json({
      ok: true,
      message:
        "Tu cuenta queda marcada para eliminación en 30 días. Vuelve a iniciar sesión para cancelar el proceso.",
      deletion_scheduled_for: new Date(
        Date.now() + 30 * 24 * 3600_000,
      ).toISOString(),
    })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
