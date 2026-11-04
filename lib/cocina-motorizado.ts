/**
 * El motorizado visto desde la cocina · R176.
 *
 * Emilio, 04-nov: "en la pantalla de cocina se visualice dónde está el
 * motorizado, para saber cuándo hacer el pedido y estar pendiente de la
 * entrega". Traduce lo último que dijo PedidosYa a una frase para la
 * cocina, con los minutos que faltan para que llegue al local (antes de
 * recoger) o al cliente (ya en camino).
 */
export type FaseMotorizado = "buscando" | "va_al_local" | "en_el_local" | "en_camino" | "llegando" | "entregado"

export interface MotorizadoParaCocina {
  fase: FaseMotorizado
  texto: string
  /** Minutos que faltan: para llegar al local si aún no recogió; al cliente si ya salió. */
  minutos: number | null
  /** Metros que le faltan al cliente · solo cuando ya salió con el pedido. */
  metros: number | null
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

const minutosHasta = (iso: unknown, ahora: number): number | null => {
  if (typeof iso !== "string") return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.max(0, Math.round((t - ahora) / 60_000)) : null
}

/** `estadoProveedor` = el último aviso de PedidosYa (CONFIRMED, IN_PROGRESS, NEAR_PICKUP, PICKED_UP, NEAR_DROPOFF, COMPLETED). */
export function motorizadoParaCocina(
  estadoProveedor: string | null | undefined,
  retiroEstimado: unknown,
  rider: { eta_min?: unknown; distance_remaining_m?: unknown } | null | undefined,
  ahora: number = Date.now(),
): MotorizadoParaCocina {
  const eta = rider && esNumero(rider.eta_min) ? Math.max(0, Math.round(rider.eta_min)) : null
  const metros = rider && esNumero(rider.distance_remaining_m) ? Math.round(rider.distance_remaining_m) : null
  switch ((estadoProveedor ?? "").toUpperCase()) {
    case "IN_PROGRESS":
      return { fase: "va_al_local", texto: "Motorizado asignado · va hacia el local", minutos: minutosHasta(retiroEstimado, ahora), metros: null }
    case "NEAR_PICKUP":
      return { fase: "en_el_local", texto: "Motorizado llegando al local · ten el pedido listo", minutos: minutosHasta(retiroEstimado, ahora), metros: null }
    case "PICKED_UP":
      return { fase: "en_camino", texto: "Ya salió con el pedido", minutos: eta, metros }
    case "NEAR_DROPOFF":
      return { fase: "llegando", texto: "Llegando donde el cliente", minutos: eta, metros }
    case "COMPLETED":
      return { fase: "entregado", texto: "Entregado", minutos: null, metros: null }
    default:
      return { fase: "buscando", texto: "Buscando motorizado · PedidosYa aún no asigna a nadie", minutos: minutosHasta(retiroEstimado, ahora), metros: null }
  }
}
