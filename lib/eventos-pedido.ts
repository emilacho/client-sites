/**
 * R190 · Único lugar que guarda en la bitácora del pedido.
 *
 * La librería de la base NO lanza excepción cuando la base rechaza una
 * fila: lo devuelve en `.error`. Por eso cada ruta creía haber guardado
 * sus eventos, y 4 tipos más un actor llevaban meses perdiéndose sin que
 * nadie lo supiera. Dos de esos eventos eran el control para no repetir
 * WhatsApp al cliente.
 *
 * Nunca lanza: no guardar un evento no debe tumbar un pedido. Pero queda
 * en el registro, y devuelve si se guardó.
 */
import type {
  NaufragoOrderEventActor,
  NaufragoOrderEventType,
} from "@/lib/schemas"

export interface EventoDePedido {
  order_id: string
  event_type: NaufragoOrderEventType
  actor: NaufragoOrderEventActor
  payload?: Record<string, unknown>
}

interface BaseQueGuarda {
  from(tabla: string): {
    insert(fila: EventoDePedido): PromiseLike<{ error: { message: string } | null }>
  }
}

export async function guardarEvento(
  base: unknown,
  evento: EventoDePedido,
): Promise<boolean> {
  const dime = (motivo: string) =>
    console.error(
      `[eventos] No se guardó ${evento.event_type} del pedido ${evento.order_id}: ${motivo}`,
    )
  try {
    const { error } = await (base as BaseQueGuarda)
      .from("order_events")
      .insert(evento)
    if (error) {
      dime(error.message)
      return false
    }
    return true
  } catch (err) {
    dime(err instanceof Error ? err.message : "desconocido")
    return false
  }
}
