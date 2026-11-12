import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { telefonoCanonico } from "@/lib/telefono"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { generarFicha, limpiarNombre, normalizarCodigo } from "@/lib/residentes"

/**
 * POST /api/residentes/registro · tarjeta de residente de Olón.
 *
 * Body · { codigo, nombre, whatsapp }
 * Respuestas:
 *   200 { ok: true, ficha }                       → la página va a /residentes/tarjeta/<ficha>
 *   400 { ok: false, error: "datos_invalidos" }   → nombre o teléfono que no sirven
 *   404 { ok: false, error: "codigo_invalido" }   → no existe, ya se usó o está anulado
 *   409 { ok: false, error: "ya_registrado" }     → ese teléfono ya tiene tarjeta activa
 *   429 { ok: false, error: "demasiados_intentos" }
 *   500 { ok: false, error: "error_interno" }
 *
 * El código se comprueba y se gasta en la base en UN solo paso (naufrago.registrar_residente):
 * dos personas con el mismo código no pueden quedar las dos registradas. Un intento rechazado no lo gasta.
 */

export const runtime = "nodejs"

const LIMITE = { limit: 8, windowSec: 600, bucket: "residentes-registro" }

export async function POST(req: NextRequest) {
  const limite = await checkRateLimit(getClientIp(req), LIMITE)
  if (!limite.ok) {
    return Response.json(
      { ok: false, error: "demasiados_intentos" },
      { status: 429, headers: { "Retry-After": String(limite.resetIn) } },
    )
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, error: "datos_invalidos" }, { status: 400 })
  }
  if (!body || typeof body !== "object") {
    return Response.json({ ok: false, error: "datos_invalidos" }, { status: 400 })
  }

  const codigo = normalizarCodigo(body.codigo)
  const nombre = limpiarNombre(body.nombre)
  const whatsapp = telefonoCanonico(typeof body.whatsapp === "string" ? body.whatsapp : null)
  if (!nombre || !whatsapp) {
    return Response.json({ ok: false, error: "datos_invalidos" }, { status: 400 })
  }
  if (!codigo) {
    return Response.json({ ok: false, error: "codigo_invalido" }, { status: 404 })
  }

  try {
    const { data, error } = await getSupabaseAdmin().rpc("registrar_residente", {
      p_codigo: codigo,
      p_nombre: nombre,
      p_whatsapp: whatsapp,
      p_ficha: generarFicha(),
    })
    if (error) throw error
    const r = (data ?? {}) as { resultado?: string; ficha?: string }
    if (r.resultado === "ok" && typeof r.ficha === "string") {
      return Response.json({ ok: true, ficha: r.ficha })
    }
    if (r.resultado === "codigo_invalido") {
      return Response.json({ ok: false, error: "codigo_invalido" }, { status: 404 })
    }
    if (r.resultado === "ya_registrado") {
      return Response.json({ ok: false, error: "ya_registrado" }, { status: 409 })
    }
    throw new Error(`respuesta inesperada de registrar_residente: ${JSON.stringify(r)}`)
  } catch (e) {
    console.error("[residentes/registro]", e instanceof Error ? e.message : e)
    return Response.json({ ok: false, error: "error_interno" }, { status: 500 })
  }
}
