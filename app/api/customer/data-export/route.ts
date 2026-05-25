import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/customer/data-export · R96.129 · LOPDP Ecuador derecho de acceso
 *
 * Auth · Bearer Supabase Auth. Devuelve JSON con TODO el data PII del
 * cliente · customer profile + orders + loyalty + easy_order + consent log.
 * Cliente puede descargar como `naufrago-mis-datos.json`.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLIENT_SLUG = "naufrago"

export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null
  if (!token) {
    return Response.json({ ok: false, error: "no_auth" }, { status: 401 })
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
      .from("naufrago_customers")
      .select("*")
      .eq("client_slug", CLIENT_SLUG)
      .eq("auth_user_id", authUser.id)
      .maybeSingle()

    const exportData: Record<string, unknown> = {
      exported_at: new Date().toISOString(),
      auth_user: {
        id: authUser.id,
        email: authUser.email,
        created_at: authUser.created_at,
      },
      customer: customer ?? null,
    }

    if (customer?.whatsapp_e164) {
      const [orders, loyaltyBalance, loyaltyLedger, easyOrder, consents] =
        await Promise.all([
          supa
            .from("naufrago_orders")
            .select(
              "order_code, status, subtotal_usd, discount_code, discount_usd, delivery_fee_usd, total_usd, cart_lines, dropoff_address, dropoff_detail, payment_method, customer_notes, created_at, delivered_at",
            )
            .eq("client_slug", CLIENT_SLUG)
            .eq("customer_phone", customer.whatsapp_e164),
          supa
            .from("naufrago_loyalty_balance")
            .select("perlas, earned_total, spent_total, updated_at")
            .eq("client_slug", CLIENT_SLUG)
            .eq("phone", customer.whatsapp_e164)
            .maybeSingle(),
          supa
            .from("naufrago_loyalty_ledger")
            .select("delta, reason, order_code, created_at")
            .eq("client_slug", CLIENT_SLUG)
            .eq("phone", customer.whatsapp_e164),
          supa
            .from("naufrago_easy_orders")
            .select(
              "nickname, cart_lines, dropoff, payment_method, total_usd, source_order_code, updated_at",
            )
            .eq("client_slug", CLIENT_SLUG)
            .eq("whatsapp_e164", customer.whatsapp_e164)
            .maybeSingle(),
          supa
            .from("naufrago_consent_log")
            .select("consent_type, accepted, url, created_at")
            .eq("client_slug", CLIENT_SLUG)
            .eq("customer_id", customer.id),
        ])
      exportData.orders = orders.data ?? []
      exportData.loyalty_balance = loyaltyBalance.data ?? null
      exportData.loyalty_ledger = loyaltyLedger.data ?? []
      exportData.easy_order = easyOrder.data ?? null
      exportData.consents = consents.data ?? []
    }

    return Response.json(exportData, {
      headers: {
        "content-disposition":
          'attachment; filename="naufrago-mis-datos.json"',
        "content-type": "application/json",
      },
    })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
