import type { NextRequest } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * GET /api/orders/by-account · R96.115 · Fase C
 *
 * Lee Bearer access_token (Supabase Auth) · resuelve customer por
 * auth_user_id · si tiene whatsapp_e164 · devuelve hasta 20 pedidos
 * del cliente order_by created_at desc. Cursor pagination · query
 * param ?before=<order_code> filtra created_at < el del order_code.
 *
 * Response · { ok, orders: [...], hasMore }
 *   order · { order_code, status, total_usd, subtotal_usd, cart_lines, created_at, delivered_at }
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLIENT_SLUG = "naufrago"
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

export async function GET(req: NextRequest) {
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

  // Parse query params · limit + before cursor (order_code)
  const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "")
  const limit = Math.min(
    Math.max(Number.isFinite(limitParam) && limitParam > 0 ? limitParam : DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  )
  const before = req.nextUrl.searchParams.get("before") || null

  try {
    const supa = getSupabaseAdmin()

    // Customer lookup by auth_user_id.
    const { data: customer } = await supa
      .from("naufrago_customers")
      .select("whatsapp_e164")
      .eq("client_slug", CLIENT_SLUG)
      .eq("auth_user_id", authUser.id)
      .maybeSingle()

    if (!customer?.whatsapp_e164) {
      return Response.json({ ok: true, orders: [], hasMore: false })
    }

    // Resolve before cursor → fetch its created_at.
    let beforeCreatedAt: string | null = null
    if (before) {
      const { data: cursorRow } = await supa
        .from("naufrago_orders")
        .select("created_at")
        .eq("order_code", before)
        .maybeSingle()
      beforeCreatedAt = cursorRow?.created_at ?? null
    }

    // Query orders · fetch limit + 1 para saber si hay más.
    let q = supa
      .from("naufrago_orders")
      .select(
        "order_code, status, total_usd, subtotal_usd, cart_lines, created_at, delivered_at",
      )
      .eq("client_slug", CLIENT_SLUG)
      .eq("customer_phone", customer.whatsapp_e164)
      .order("created_at", { ascending: false })
      .limit(limit + 1)
    if (beforeCreatedAt) {
      q = q.lt("created_at", beforeCreatedAt)
    }

    const { data: rows, error } = await q
    if (error) {
      return Response.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 },
      )
    }
    const list = rows ?? []
    const hasMore = list.length > limit
    const orders = hasMore ? list.slice(0, limit) : list

    return Response.json({ ok: true, orders, hasMore })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
