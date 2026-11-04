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
  /** La frase para leer de un vistazo: «El motorizado llega al local en aproximadamente 5 min». null si no se sabe el tiempo. */
  frase: string | null
  /** R178 · quién viene y con qué código se identifica el envío, para reconocerlo en la puerta. */
  nombre?: string | null
  vehiculo?: string | null
  codigo?: string | null
}

const enMinutos = (m: number): string => (m <= 1 ? "1 min" : `${m} min`)

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

const minutosHasta = (iso: unknown, ahora: number): number | null => {
  if (typeof iso !== "string") return null
  const t = Date.parse(iso)
  return Number.isFinite(t) ? Math.max(0, Math.round((t - ahora) / 60_000)) : null
}

type SinFrase = Omit<MotorizadoParaCocina, "frase">
const conFrase = (m: SinFrase, hacia: string | null): MotorizadoParaCocina => ({
  ...m,
  frase: hacia && m.minutos !== null ? `El motorizado llega ${hacia} en aproximadamente ${enMinutos(m.minutos)}` : null,
})

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
      return conFrase({ fase: "va_al_local", texto: "Motorizado asignado · va hacia el local", minutos: minutosHasta(retiroEstimado, ahora), metros: null }, "al local")
    case "NEAR_PICKUP":
      return conFrase({ fase: "en_el_local", texto: "Motorizado llegando al local · ten el pedido listo", minutos: minutosHasta(retiroEstimado, ahora), metros: null }, "al local")
    case "PICKED_UP":
      return conFrase({ fase: "en_camino", texto: "Ya salió con el pedido", minutos: eta, metros }, "donde el cliente")
    case "NEAR_DROPOFF":
      return conFrase({ fase: "llegando", texto: "Llegando donde el cliente", minutos: eta, metros }, "donde el cliente")
    case "COMPLETED":
      return conFrase({ fase: "entregado", texto: "Entregado", minutos: null, metros: null }, null)
    default:
      return conFrase({ fase: "buscando", texto: "Buscando motorizado · PedidosYa aún no asigna a nadie", minutos: minutosHasta(retiroEstimado, ahora), metros: null }, null)
  }
}
