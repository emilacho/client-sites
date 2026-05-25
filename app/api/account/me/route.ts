import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { verifySession, COOKIE_NAME } from "@/lib/account-session"

/**
 * GET /api/account/me · R96.112
 *
 * Lee cookie naufrago_session · si válida · devuelve perfil del cliente
 * (name + email + perlas balance + dirs count + last_order_at).
 * Si no hay cookie o expirada · { ok: false, authenticated: false }.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLIENT_SLUG = "naufrago"

export async function GET(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value
  const session = verifySession(token)
  if (!session) {
    return Response.json({ ok: false, authenticated: false })
  }
  try {
    const supa = getSupabaseAdmin()
    const [{ data: customer }, { data: balance }] = await Promise.all([
      supa
        .from("naufrago_customers")
        .select(
          "name, email, addresses, total_orders, total_spend_usd, first_order_at, last_order_at, preferences",
        )
        .eq("client_slug", CLIENT_SLUG)
        .eq("whatsapp_e164", session.whatsapp)
        .maybeSingle(),
      supa
        .from("naufrago_loyalty_balance")
        .select("perlas, earned_total, spent_total")
        .eq("client_slug", CLIENT_SLUG)
        .eq("phone", session.whatsapp)
        .maybeSingle(),
    ])
    return Response.json({
      ok: true,
      authenticated: true,
      whatsapp: session.whatsapp,
      name: customer?.name ?? null,
      email: customer?.email ?? null,
      addresses: Array.isArray(customer?.addresses) ? customer.addresses : [],
      preferences: customer?.preferences ?? null,
      totalOrders: customer?.total_orders ?? 0,
      totalSpendUsd: Number(customer?.total_spend_usd ?? 0),
      firstOrderAt: customer?.first_order_at ?? null,
      lastOrderAt: customer?.last_order_at ?? null,
      perlas: balance?.perlas ?? 0,
      earnedTotal: balance?.earned_total ?? 0,
      spentTotal: balance?.spent_total ?? 0,
    })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
