import "server-only"
/**
 * Qué formas de pago se pueden cobrar DE VERDAD · R148.
 *
 * Hasta hoy la pantalla ofrecía seis y ninguna de las cinco digitales
 * cobraba: el botón esperaba segundo y medio y confirmaba el pedido
 * igual. El cliente creía que había pagado con tarjeta y nadie cobró.
 * El servidor ya sabía cuáles había —lo decía en cada cotización— pero
 * la pantalla nunca leyó esa lista.
 *
 * Acá vive la respuesta, en un solo lugar, y la pantalla la obedece.
 * El día que lleguen las credenciales de una forma nueva, se enciende
 * sola: no hay que tocar la pantalla.
 *
 * La Cajita de PayPhone resuelve DOS de las seis con una sola
 * integración: la tarjeta y su propia billetera. Es el mismo formulario
 * con `defaultMethod` distinto.
 */

export type MetodoDePago =
  | "card"
  | "cash"
  | "deuna"
  | "payphone"
  | "apple_pay"
  | "google_pay"

export function payphoneConfigurado(): boolean {
  return Boolean(
    process.env.PAYPHONE_TOKEN && process.env.PAYPHONE_STORE_ID,
  )
}

/** Las que se pueden cobrar hoy, con las credenciales que hay cargadas. */
export function metodosDisponibles(): MetodoDePago[] {
  const metodos: MetodoDePago[] = []

  // La Cajita cubre tarjeta + billetera PayPhone con una sola credencial.
  if (payphoneConfigurado()) metodos.push("card", "payphone")

  // Efectivo siempre · desde R144 el motorizado cobra de verdad en la
  // puerta, así que no es una promesa vacía.
  metodos.push("cash")

  // `deuna`, `apple_pay` y `google_pay` NO se listan a propósito: nadie
  // las integró todavía. Cuando alguna se integre, se agrega acá y la
  // pantalla la muestra sola.
  return metodos
}

/**
 * El mismo dato, en el otro vocabulario.
 *
 * Hay dos formas de nombrar lo mismo y conviene no mezclarlas:
 *   · la de la PANTALLA · "card" · "cash" · "payphone"
 *   · la de la BASE     · "CARD_CREDIT" · "CASH_ON_DELIVERY" · "PAYPHONE"
 *     (es la lista que acepta la columna payment_method y la que
 *      entiende el resto del sistema)
 *
 * Una prueba automática cazó esta mezcla al primer intento.
 */
const EQUIVALENCIA: Record<MetodoDePago, string> = {
  card: "CARD_CREDIT",
  cash: "CASH_ON_DELIVERY",
  payphone: "PAYPHONE",
  deuna: "DEUNA",
  apple_pay: "GOOGLE_PAY",
  google_pay: "GOOGLE_PAY",
}

/** Las disponibles, nombradas como las nombra la base. */
export function metodosDisponiblesEnBase(): string[] {
  const lista = metodosDisponibles().map((m) => EQUIVALENCIA[m])
  // Coordinar por WhatsApp siempre está · no es una pasarela, es una
  // persona atendiendo. Sólo existe en este vocabulario.
  lista.push("WHATSAPP_MANUAL")
  return lista
}
