import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * GET /api/account/me · R96.113
 *
 * Lee Bearer access_token (Supabase Auth) · si válido · resuelve el
 * perfil naufrago_customers · auto-create + link si es primer login.
 * WhatsApp es opcional · null hasta que el cliente lo ingrese en su
 * primer pedido.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLIENT_SLUG = "naufrago"

export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) {
    return Response.json({ ok: false, authenticated: false })
  }

  // Validate the access_token con anon client → getUser
  const url =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
  if (!url || !anon) {
    return Response.json({ ok: false, error: "supabase_not_configured" }, { status: 500 })
  }
  const anonClient = createClient(url, anon, { auth: { persistSession: false } })
  const { data: userRes, error: userErr } = await anonClient.auth.getUser(token)
  if (userErr || !userRes?.user) {
    return Response.json({ ok: false, authenticated: false })
  }
  const authUser = userRes.user

  try {
    const supa = getSupabaseAdmin()

    // 1) Buscar por auth_user_id (ya linkeado).
    let { data: customer } = await supa
      .from("customers")
      .select(
        "id, name, email, whatsapp_e164, addresses, preferences, total_orders, total_spend_usd, first_order_at, last_order_at",
      )
      .eq("client_slug", CLIENT_SLUG)
      .eq("auth_user_id", authUser.id)
      .maybeSingle()

    // 2) Si no existe · intentar link por email match (perfil legacy
    //    creado por pedido WhatsApp anterior · ahora se loguea con
    //    mismo email Google).
    if (!customer && authUser.email) {
      const { data: byEmail } = await supa
        .from("customers")
        .select(
          "id, name, email, whatsapp_e164, addresses, preferences, total_orders, total_spend_usd, first_order_at, last_order_at",
        )
        .eq("client_slug", CLIENT_SLUG)
        .eq("email", authUser.email)
        .is("auth_user_id", null)
        .maybeSingle()
      if (byEmail) {
        await supa
          .from("customers")
          .update({ auth_user_id: authUser.id })
          .eq("id", byEmail.id)
        customer = byEmail
      }
    }

    // 3) Si sigue null · primer login · crear row vacía.
    if (!customer) {
      const initialName =
        (authUser.user_metadata?.full_name as string | undefined) ||
        (authUser.user_metadata?.name as string | undefined) ||
        null
      const { data: created } = await supa
        .from("customers")
        .insert({
          client_slug: CLIENT_SLUG,
          auth_user_id: authUser.id,
          email: authUser.email ?? null,
          name: initialName,
        })
        .select(
          "id, name, email, whatsapp_e164, addresses, preferences, total_orders, total_spend_usd, first_order_at, last_order_at",
        )
        .single()
      customer = created
    }

    // 4) Balance perlas · keyed by whatsapp · null si no hay whatsapp aún.
    let perlas = 0
    let earnedTotal = 0
    let spentTotal = 0
    if (customer?.whatsapp_e164) {
      const { data: balance } = await supa
        .from("loyalty_balance")
        .select("perlas, earned_total, spent_total")
        .eq("client_slug", CLIENT_SLUG)
        .eq("phone", customer.whatsapp_e164)
        .maybeSingle()
      perlas = balance?.perlas ?? 0
      earnedTotal = balance?.earned_total ?? 0
      spentTotal = balance?.spent_total ?? 0
    }

    return Response.json({
      ok: true,
      authenticated: true,
      authUserId: authUser.id,
      email: customer?.email ?? authUser.email ?? null,
      whatsapp: customer?.whatsapp_e164 ?? null,
      name: customer?.name ?? null,
      addresses: Array.isArray(customer?.addresses) ? customer!.addresses : [],
      preferences: customer?.preferences ?? null,
      totalOrders: customer?.total_orders ?? 0,
      totalSpendUsd: Number(customer?.total_spend_usd ?? 0),
      firstOrderAt: customer?.first_order_at ?? null,
      lastOrderAt: customer?.last_order_at ?? null,
      perlas,
      earnedTotal,
      spentTotal,
    })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
