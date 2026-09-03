import { NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase"
import { quienPregunta } from "@/lib/quien-pregunta"

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
  // R151 · freno por origen. Estas rutas entregan datos de una persona
  // a quien acierte un código o un teléfono · sin freno, probar millones
  // de combinaciones no cuesta nada.
  {
    const rl = await checkRateLimit(getClientIp(_req), {
      limit: 15,
      windowSec: 60,
      bucket: "saldo_perlas",
    })
    if (!rl.ok) {
      return Response.json(
        { ok: false, error: "rate_limited", retryIn: rl.resetIn },
        { status: 429 },
      )
    }
  }

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
      .from("loyalty_balance")
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
    // R151 · esta ruta tiene que seguir andando SIN sesión: el cliente
    // escribe su teléfono en el pedido y la pantalla le muestra su
    // tesoro antes de entrar a ninguna cuenta. No se puede cerrar sin
    // romper eso.
    //
    // Lo que sí se puede es dejar de regalar lo sensible. El saldo
    // actual hace falta para poder canjearlo · el HISTÓRICO de cuánto
    // gastó esa persona en su vida no hace falta para nada en la
    // pantalla, y era lo peor de entregar a quien adivine un número.
    // Sólo sale si demuestra que la cuenta es suya.
    const suyo = await quienPregunta(_req)
    const esElDueno = suyo?.whatsapp === normalized
    const historico = esElDueno
      ? { earnedTotal: data?.earned_total ?? 0, spentTotal: data?.spent_total ?? 0 }
      : {}
    return NextResponse.json({
      ok: true,
      phone: normalized,
      perlas: data?.perlas ?? 0,
      ...historico,
      updatedAt: data?.updated_at ?? null,
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
