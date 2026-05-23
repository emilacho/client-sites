import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"

/**
 * GET /api/loyalty/[phone] · R96.21 · balance lookup público.
 *
 * Identity = phone (sin auth en MVP). Phone normalizado a E.164
 * EC antes de query. Si no existe row · devuelve balance 0.
 *
 * Para spend en cart drawer · cliente lookup balance al typear su
 * phone en el address form · ve cuántas perlas tiene + slider.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function normalizeE164(raw: string): string | null {
  const digits = raw.replace(/\D/g, "")
  if (digits.length < 8 || digits.length > 15) return null
  if (digits.startsWith("0")) return `593${digits.slice(1)}`
  if (digits.length === 9 && digits.startsWith("9")) return `593${digits}`
  return digits
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ phone: string }> },
) {
  const { phone } = await ctx.params
  const normalized = normalizeE164(decodeURIComponent(phone))
  if (!normalized) {
    return NextResponse.json(
      { ok: false, error: "invalid_phone" },
      { status: 400 },
    )
  }

  try {
    const supa = getSupabaseAdmin()
    const { data, error } = await supa
      .from("naufrago_loyalty_balance")
      .select("perlas, earned_total, spent_total, updated_at")
      .eq("client_slug", "naufrago")
      .eq("phone", normalized)
      .maybeSingle()
    if (error) {
      return NextResponse.json(
        { ok: false, error: "db_error", detail: error.message },
        { status: 500 },
      )
    }
    if (!data) {
      return NextResponse.json({
        ok: true,
        phone: normalized,
        perlas: 0,
        earnedTotal: 0,
        spentTotal: 0,
        updatedAt: null,
      })
    }
    return NextResponse.json({
      ok: true,
      phone: normalized,
      perlas: data.perlas,
      earnedTotal: data.earned_total,
      spentTotal: data.spent_total,
      updatedAt: data.updated_at,
    })
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "unknown_error",
      },
      { status: 500 },
    )
  }
}
