import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/push/subscribe · R96.17 · persiste browser PushSubscription
 *
 * Body · { orderCode, endpoint, p256dh, auth, userAgent? }
 *
 * Idempotent · UPSERT por (order_code, endpoint). Resubscribe del mismo
 * browser para el mismo order solo refresca keys + reset unsubscribed.
 */

export const runtime = "nodejs"

const NF_CODE_REGEX = /^NF-\d{4}-[A-Z0-9]{6}$/i

interface Body {
  orderCode?: unknown
  endpoint?: unknown
  p256dh?: unknown
  auth?: unknown
  userAgent?: unknown
}

export async function POST(req: NextRequest) {
  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const orderCode =
    typeof body.orderCode === "string" ? body.orderCode.toUpperCase() : ""
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : ""
  const p256dh = typeof body.p256dh === "string" ? body.p256dh : ""
  const auth = typeof body.auth === "string" ? body.auth : ""
  const userAgent =
    typeof body.userAgent === "string" ? body.userAgent.slice(0, 300) : null

  if (!NF_CODE_REGEX.test(orderCode)) {
    return Response.json(
      { ok: false, error: "invalid_order_code" },
      { status: 400 },
    )
  }
  if (!endpoint || !p256dh || !auth) {
    return Response.json({ ok: false, error: "missing_keys" }, { status: 400 })
  }

  try {
    const supa = getSupabaseAdmin()
    const { error } = await supa
      .from("naufrago_push_subscriptions")
      .upsert(
        {
          client_slug: "naufrago",
          order_code: orderCode,
          endpoint,
          p256dh,
          auth,
          user_agent: userAgent,
          unsubscribed: false,
        },
        { onConflict: "order_code,endpoint" },
      )
    if (error) {
      return Response.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 },
      )
    }
    return Response.json({ ok: true })
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
