import type { NextRequest } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase"
import { quienPregunta } from "@/lib/quien-pregunta"

/**
 * GET /api/subscribers/lookup?whatsapp=... · R96.144
 *
 * Devuelve el estado actual de opt-in promos del cliente para
 * mostrarlo en /mi-cuenta sección Notificaciones.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLIENT_SLUG = "naufrago"


export async function GET(req: NextRequest) {
  // R151 · freno por origen. Estas rutas entregan datos de una persona
  // a quien acierte un código o un teléfono · sin freno, probar millones
  // de combinaciones no cuesta nada.
  {
    const rl = await checkRateLimit(getClientIp(req), {
      limit: 20,
      windowSec: 60,
      bucket: "preferencias_aviso",
    })
    if (!rl.ok) {
      return Response.json(
        { ok: false, error: "rate_limited", retryIn: rl.resetIn },
        { status: 429 },
      )
    }
  }

  // R151 · antes bastaba con poner el número de otro para saber si esa
  // persona es cliente y si acepta promociones. Esta pantalla vive
  // dentro de «Mi cuenta», donde el cliente YA está identificado ·
  // ahora se usa esa sesión y el teléfono lo resuelve el servidor.
  const quien = await quienPregunta(req)
  if (!quien) {
    return Response.json({ ok: false, error: "no_autorizado" }, { status: 401 })
  }
  const whatsapp = quien.whatsapp
  try {
    const supa = getSupabaseAdmin()
    const { data } = await supa
      .from("subscribers")
      .select("opt_in_promos, opt_in_tracking")
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", whatsapp)
      .maybeSingle()
    return Response.json({
      ok: true,
      opt_in_promos: data?.opt_in_promos ?? false,
      opt_in_tracking: data?.opt_in_tracking ?? false,
    })
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : "unknown" },
      { status: 500 },
    )
  }
}
