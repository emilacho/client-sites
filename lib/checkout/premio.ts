import "server-only"
/**
 * El premio del tesoro · R157
 *
 * Decisión de Emilio (04-sep): las perlas dejan de canjearse por dinero
 * y se acumulan para ganar UN premio. Al llegar al tope, el cliente
 * toca "Reclamar" y elige entre chifle, pan o cola.
 *
 * POR QUÉ ASÍ Y NO CON DESCUENTO
 * El canje por dinero nunca se terminó (ver hallazgo 04-sep): la
 * pantalla restaba del total y el servidor lo ignoraba. Un premio en
 * producto no toca el total que se cobra · no hay cuentas que cuadrar,
 * ni riesgo de cobrar distinto a lo que el cliente vio.
 *
 * DE DÓNDE PUEDE VENIR UN REGALO
 * Las mismas tres líneas a $0 sirven para dos cosas distintas, y hay
 * que saber cuál, porque una cuesta perlas y la otra no:
 *
 *   ruleta  · lo ganó girando · gratis · ya existía
 *   perlas  · llegó al tope · se le descuentan las perlas
 *
 * Sin justificación, la línea del regalo NO se acepta. Antes (R156) se
 * aceptaba a ciegas · quedaba anotado como deuda y se salda acá.
 */
import { getSupabaseAdmin } from "@/lib/supabase"
import { telefonoCanonico } from "@/lib/telefono"
import { spendPerlas } from "@/lib/loyalty-server"

const CLIENT_SLUG = "naufrago"

/** Cuántas perlas cuesta el premio · Emilio, 04-sep: "que gasten 60 dólares".
 *  Se ganan 4 perlas por dólar, así que $60 son 240 perlas.
 *  Vive en un solo lugar · la pantalla lee el mismo número. */
export { PERLAS_PARA_EL_PREMIO } from "@/lib/loyalty-server"
import { PERLAS_PARA_EL_PREMIO } from "@/lib/loyalty-server"

/** Los tres que se pueden elegir · valen $0 y ya están en la caja. */
export const PREMIOS_POSIBLES = ["prize-chifle", "prize-pan", "prize-cola"] as const
export type PremioPosible = (typeof PREMIOS_POSIBLES)[number]

/** Qué premio de la ruleta corresponde a cada línea. */
const PREMIO_SEGUN_RULETA: Record<string, PremioPosible> = {
  chifle: "prize-chifle",
  pan: "prize-pan",
  cola: "prize-cola",
}

export interface PremioReclamado {
  id: string
  origen: "ruleta" | "perlas"
  /** Sólo para la ruleta · la huella del navegador que giró. */
  huella?: string
}

export interface VeredictoPremio {
  aceptado: boolean
  /** El id que queda autorizado · null si no se acepta ninguno. */
  idAutorizado: string | null
  motivo?: string
}

export function esPremioPosible(id: string): id is PremioPosible {
  return (PREMIOS_POSIBLES as readonly string[]).includes(id)
}

/**
 * ¿Se le puede dar este regalo? Y si cuesta perlas, se las descuenta.
 *
 * Se descuenta ACÁ y no antes a propósito: si el pedido falla después,
 * no se le cobraron perlas por un pedido que no existe.
 */
export async function autorizarPremio(
  premio: PremioReclamado | null | undefined,
  telefonoCrudo: string | null | undefined,
  orderCode: string,
): Promise<VeredictoPremio> {
  if (!premio) return { aceptado: false, idAutorizado: null }
  if (!esPremioPosible(premio.id)) {
    return { aceptado: false, idAutorizado: null, motivo: "premio_desconocido" }
  }

  if (premio.origen === "ruleta") {
    if (!premio.huella) {
      return { aceptado: false, idAutorizado: null, motivo: "sin_huella" }
    }
    try {
      const desde = new Date(Date.now() - 24 * 3600_000).toISOString()
      const { data } = await getSupabaseAdmin()
        .from("ruleta_spins")
        .select("prize")
        .eq("client_slug", CLIENT_SLUG)
        .eq("fingerprint", premio.huella)
        .gte("spun_at", desde)
        .order("spun_at", { ascending: false })
        .limit(1)
      const giro = (data as { prize?: string }[] | null)?.[0]
      if (!giro?.prize) {
        return { aceptado: false, idAutorizado: null, motivo: "no_giro_la_ruleta" }
      }
      if (PREMIO_SEGUN_RULETA[giro.prize] !== premio.id) {
        return { aceptado: false, idAutorizado: null, motivo: "gano_otro_premio" }
      }
      return { aceptado: true, idAutorizado: premio.id }
    } catch {
      return { aceptado: false, idAutorizado: null, motivo: "no_se_pudo_comprobar" }
    }
  }

  // Origen perlas · hace falta el teléfono para saber de quién es el tesoro.
  const telefono = telefonoCanonico(telefonoCrudo)
  if (!telefono) {
    return { aceptado: false, idAutorizado: null, motivo: "sin_telefono" }
  }
  const gastado = await spendPerlas({
    phone: telefono,
    amount: PERLAS_PARA_EL_PREMIO,
    orderCode,
  })
  if (!gastado) {
    return { aceptado: false, idAutorizado: null, motivo: "no_le_alcanzan_las_perlas" }
  }
  return { aceptado: true, idAutorizado: premio.id }
}
