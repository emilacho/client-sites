import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * POST /api/orders/[order_code]/review · R96.16 · post-delivered
 * feedback. Cliente envía 1-5 stars + comment opcional. Idempotent
 * por order_id (UPSERT) · cliente puede editar su review.
 *
 * Body · { stars: 1-5, comment?: string }
 *
 * Constraint · solo permite review si el order está en status
 * DELIVERED · evita feedback prematuro.
 */

export const runtime = "nodejs"

interface Body {
  stars?: unknown
  comment?: unknown
}

const NF_CODE_REGEX = /^NF-\d{4}-[A-Z0-9]{6}$/i

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ order_code: string }> },
) {
  const { order_code } = await ctx.params
  if (!NF_CODE_REGEX.test(order_code)) {
    return Response.json({ ok: false, error: "invalid_order_code" }, { status: 400 })
  }

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const starsNum = Number(body.stars)
  if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 5) {
    return Response.json(
      { ok: false, error: "invalid_stars", detail: "1-5 integer" },
      { status: 400 },
    )
  }
  const commentRaw = typeof body.comment === "string" ? body.comment.trim() : ""
  const comment = commentRaw.length > 0 ? commentRaw.slice(0, 500) : null

  try {
    const supa = getSupabaseAdmin()
    // Look up order_id by order_code + verify it's DELIVERED
    const { data: order, error: orderErr } = await supa
      .from("orders")
      .select("id, status, client_slug")
      .eq("order_code", order_code.toUpperCase())
      .maybeSingle()

    if (orderErr) {
      return Response.json(
        { ok: false, error: "db_error", detail: orderErr.message },
        { status: 500 },
      )
    }
    if (!order) {
      return Response.json({ ok: false, error: "order_not_found" }, { status: 404 })
    }
    if (order.status !== "DELIVERED") {
      return Response.json(
        { ok: false, error: "order_not_delivered", status: order.status },
        { status: 400 },
      )
    }

    const { error: upsertErr } = await supa
      .from("order_reviews")
      .upsert(
        {
          order_id: order.id,
          client_slug: order.client_slug,
          stars: starsNum,
          comment,
        },
        { onConflict: "order_id" },
      )

    if (upsertErr) {
      return Response.json(
        { ok: false, error: "review_upsert_failed", detail: upsertErr.message },
        { status: 500 },
      )
    }

    return Response.json({ ok: true, stars: starsNum, comment })
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
