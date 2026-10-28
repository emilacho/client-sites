/**
 * Posición del motorizado en vivo · 28-oct.
 *
 * Emilio: el cliente tiene que ver SIEMPRE en tiempo real dónde viene el
 * motorizado, para saber cuándo salir a recibir el pedido.
 *
 * POR QUÉ ESTO EXISTÍA A MEDIAS
 * El proveedor sabe decir dónde está el motorizado (`getStatus` →
 * `/v3/shippings/{id}/tracking`) y la pantalla ya leía `eta_min` y
 * `distance_remaining_m` de `rider_info`, pero NADIE llamaba a `getStatus`:
 * esos campos nunca se llenaban y la canoa avanzaba por tiempo estimado.
 *
 * CÓMO FUNCIONA
 * Cada vez que alguien mira el pedido con el motorizado en camino, se le
 * pregunta al proveedor, pero no más de una vez cada FRESCO_MS por pedido
 * (la pantalla consulta cada 3 s y puede haber varias mirando). El
 * resultado se guarda en `rider_info`, mezclado con lo que ya hay.
 *
 * Si el proveedor no contesta o tarda, se devuelve lo último guardado:
 * una posición un poco vieja es mejor que una pantalla rota.
 */
import { getSupabaseAdmin } from "@/lib/supabase"
import { getCourierProvider } from "@/lib/courier"
import { haversineMeters } from "@/lib/geo"
import type { NaufragoOrderStatus } from "@/lib/schemas"

/** Cada cuánto, como mucho, se le pregunta al proveedor por pedido. */
export const FRESCO_MS = 8_000
/** Cuánto se espera al proveedor antes de usar lo guardado. */
const ESPERA_MAX_MS = 4_000

/** Estados en que el motorizado ya fue pedido y todavía no entregó. */
const EN_CAMINO: NaufragoOrderStatus[] = ["READY", "RIDER_PICKED_UP", "IN_TRANSIT"]

export type RiderGuardado = Record<string, unknown> & {
  latitude?: number
  longitude?: number
  distance_remaining_m?: number
  total_distance_m?: number
  eta_min?: number
  live_at?: string
}

export interface FilaEnVivo {
  id: string
  status: NaufragoOrderStatus
  delivery_provider_order_id: string | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  rider_info: RiderGuardado | null
}

const esNumero = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v)

/**
 * Devuelve el `rider_info` con la posición más fresca posible.
 * Nunca lanza: ante cualquier fallo devuelve lo que ya había.
 */
export async function refrescarPosicion(
  fila: FilaEnVivo,
  ahora: number = Date.now(),
): Promise<RiderGuardado | null> {
  const guardado = fila.rider_info
  if (!EN_CAMINO.includes(fila.status)) return guardado
  if (!fila.delivery_provider_order_id) return guardado
  // En simulacro no hay motorizado al que preguntarle.
  if (process.env.PEDIDOSYA_COURIER_MOCK === "true") return guardado

  const vistoHace = guardado?.live_at ? ahora - Date.parse(guardado.live_at) : Infinity
  if (vistoHace < FRESCO_MS) return guardado

  try {
    const proveedor = getCourierProvider("PEDIDOSYA_COURIER")
    if (!proveedor) return guardado

    const instantanea = await Promise.race([
      proveedor.getStatus(fila.delivery_provider_order_id),
      new Promise<null>((r) => setTimeout(() => r(null), ESPERA_MAX_MS)),
    ])
    if (!instantanea) return guardado

    const lat = instantanea.riderInfo?.latitude
    const lng = instantanea.riderInfo?.longitude
    const nuevo: RiderGuardado = { ...(guardado ?? {}), live_at: new Date(ahora).toISOString() }

    if (esNumero(instantanea.etaMinutes)) nuevo.eta_min = instantanea.etaMinutes

    if (esNumero(lat) && esNumero(lng)) {
      nuevo.latitude = lat
      nuevo.longitude = lng
      if (esNumero(fila.dropoff_lat) && esNumero(fila.dropoff_lng)) {
        const quedan = haversineMeters(lat, lng, fila.dropoff_lat, fila.dropoff_lng)
        nuevo.distance_remaining_m = Math.round(quedan)
        // El recorrido total: del local al cliente. Si no se conoce el
        // local, se usa la mayor distancia vista (la primera medición).
        if (!esNumero(nuevo.total_distance_m)) {
          const pLat = Number(process.env.PEDIDOSYA_COURIER_PICKUP_LAT)
          const pLng = Number(process.env.PEDIDOSYA_COURIER_PICKUP_LNG)
          nuevo.total_distance_m =
            Number.isFinite(pLat) && Number.isFinite(pLng) && pLat && pLng
              ? Math.round(haversineMeters(pLat, pLng, fila.dropoff_lat, fila.dropoff_lng))
              : Math.round(quedan)
        }
        if (quedan > (nuevo.total_distance_m as number)) {
          nuevo.total_distance_m = Math.round(quedan)
        }
      }
    }

    await getSupabaseAdmin()
      .from("orders")
      .update({ rider_info: nuevo })
      .eq("id", fila.id)
      .then(undefined, () => {})

    return nuevo
  } catch {
    return guardado
  }
}

/**
 * Lo que sale a la pantalla pública: sin las coordenadas del motorizado.
 * La ruta se abre con un código de seis caracteres; la posición exacta de
 * una persona no tiene por qué viajar ahí. Distancia y minutos bastan.
 */
export function riderParaPantalla(r: RiderGuardado | null): RiderGuardado | null {
  if (!r) return r
  const { latitude: _la, longitude: _lo, ...resto } = r
  void _la
  void _lo
  return resto
}
