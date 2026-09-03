import type { NextRequest } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase"
import { quienPregunta } from "@/lib/quien-pregunta"

/**
 * /api/customer/preferences · R96.109
 *
 * GET ?whatsapp=... → { preferences: string | null }
 * POST { whatsapp, preferences } → { ok: true }
 *
 * Notas/preferencias persistentes del cliente. Pre-fill en cart notes
 * de futuros pedidos (estilo Pizza Profile favorite-toppings).
 */

export const runtime = "nodejs"

const CLIENT_SLUG = "naufrago"
const MAX_LEN = 500


export async function GET(req: NextRequest) {
  // R151 · freno por origen. Estas rutas entregan datos de una persona
  // a quien acierte un código o un teléfono · sin freno, probar millones
  // de combinaciones no cuesta nada.
  {
    const rl = await checkRateLimit(getClientIp(req), {
      limit: 20,
      windowSec: 60,
      bucket: "preferencias",
    })
    if (!rl.ok) {
      return Response.json(
        { ok: false, error: "rate_limited", retryIn: rl.resetIn },
        { status: 429 },
      )
    }
  }

  // R151 · antes bastaba con poner el teléfono de otro en la dirección
  // para leer sus preferencias. Un teléfono no es una credencial: es un
  // dato que cualquiera puede escribir. Ahora hay que demostrar quién
  // se es —con la sesión de la cuenta o con un código de pedido— y el
  // teléfono lo resuelve el servidor.
  const quien = await quienPregunta(
    req,
    req.nextUrl.searchParams.get("orderCode"),
  )
  if (!quien) {
    return Response.json({ ok: false, error: "no_autorizado" }, { status: 401 })
  }
  const whatsapp = quien.whatsapp
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("customers")
    .select("preferences")
    .eq("client_slug", CLIENT_SLUG)
    .eq("whatsapp_e164", whatsapp)
    .maybeSingle()
  return Response.json({ ok: true, preferences: data?.preferences ?? null })
}

export async function POST(req: NextRequest) {
  let body: { orderCode?: unknown; preferences?: unknown }
  try {
    body = await req.json()
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }
  // R151 · esta es la peor de las tres: no sólo LEÍA con un teléfono
  // ajeno, ESCRIBÍA. Cualquiera podía cambiarle las preferencias a otra
  // persona sabiendo su número.
  const quien = await quienPregunta(
    req,
    typeof body.orderCode === "string" ? body.orderCode : null,
  )
  if (!quien) {
    return Response.json({ ok: false, error: "no_autorizado" }, { status: 401 })
  }
  const whatsapp = quien.whatsapp
  const pref =
    typeof body.preferences === "string"
      ? body.preferences.trim().slice(0, MAX_LEN)
      : null
  const supa = getSupabaseAdmin()
  const { error } = await supa
    .from("customers")
    .update({ preferences: pref })
    .eq("client_slug", CLIENT_SLUG)
    .eq("whatsapp_e164", whatsapp)
  if (error) {
    return Response.json(
      { ok: false, error: "db_error", detail: error.message },
      { status: 500 },
    )
  }
  return Response.json({ ok: true })
}
