import "server-only"
/**
 * ¿Este cliente tiene derecho a este cupón? · R155
 *
 * EL AGUJERO
 * Las reglas del cupón vivían en `/api/promo/validate` · una ruta que el
 * cliente puede simplemente NO llamar. La pantalla la llamaba de buena
 * fe, pero quien manda el pedido directo se saltaba las reglas:
 *
 *   /api/promo/validate  →  comprueba 24h de espera + $25 acumulados
 *   /api/courier/order   →  aplicaba el 5% sin preguntar nada
 *
 * Es la misma familia del precio alterado (R154): la comprobación estaba
 * en una puerta y el dinero entraba por la otra.
 *
 * Y ADEMÁS, DESCUADRABA
 * El descuento se le restaba a lo que cobra el motorizado, pero NO se
 * guardaba en el pedido. El motorizado cobraba $40.50 y la ficha decía
 * $42.50. Los libros no cerraban contra la plata.
 *
 * Las reglas son las mismas de siempre · acá viven una sola vez y las
 * usan las dos puertas.
 */
import { getSupabaseAdmin } from "@/lib/supabase"
import { telefonoCanonico } from "@/lib/telefono"

const CLIENT_SLUG = "naufrago"
export const HORAS_DE_ESPERA = 24
export const GASTO_QUE_HABILITA_USD = 25

export type MotivoRechazo =
  | "codigo_desconocido"
  | "sin_telefono"
  | "todavia_no_pasaron_24h"
  | "le_falta_gastar"

export interface DerechoAlCupon {
  tieneDerecho: boolean
  motivo?: MotivoRechazo
}

/** Los códigos con reglas. Los que no están acá no llevan reglas. */
const CON_REGLAS = new Set(["SURFBOLLADO"])

export async function tieneDerechoAlCupon(
  codigo: string | null | undefined,
  telefonoCrudo: string | null | undefined,
): Promise<DerechoAlCupon> {
  const code = (codigo ?? "").trim().toUpperCase()
  if (!code) return { tieneDerecho: false, motivo: "codigo_desconocido" }
  if (!CON_REGLAS.has(code)) return { tieneDerecho: true }

  const telefono = telefonoCanonico(telefonoCrudo)
  if (!telefono) return { tieneDerecho: false, motivo: "sin_telefono" }

  try {
    const { data: filas } = await getSupabaseAdmin()
      .from("promo_usage")
      .select("last_used_at, qualifying_spend_since_last_use")
      .eq("client_slug", CLIENT_SLUG)
      .eq("whatsapp_e164", telefono)
      .eq("code", code)
      .limit(1)

    // Nunca lo usó · primer uso libre.
    if (!filas || filas.length === 0) return { tieneDerecho: true }

    const fila = filas[0] as {
      last_used_at: string
      qualifying_spend_since_last_use: number | null
    }
    const horas = (Date.now() - new Date(fila.last_used_at).getTime()) / 3600_000
    if (horas < HORAS_DE_ESPERA) {
      return { tieneDerecho: false, motivo: "todavia_no_pasaron_24h" }
    }
    const gastado = Number(fila.qualifying_spend_since_last_use ?? 0)
    if (gastado < GASTO_QUE_HABILITA_USD) {
      return { tieneDerecho: false, motivo: "le_falta_gastar" }
    }
    return { tieneDerecho: true }
  } catch {
    // Si no se puede comprobar, NO se regala el descuento. Antes se
    // aplicaba sin preguntar · el que falla ahora es el descuento, no
    // el pedido.
    return { tieneDerecho: false, motivo: "codigo_desconocido" }
  }
}
