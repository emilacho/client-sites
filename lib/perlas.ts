/**
 * La regla de las perlas · UN solo lugar · R120.
 *
 * Antes esta regla estaba escrita a mano en TRES lugares que no se hablaban
 * entre sí: el servidor que acredita las perlas (EARN_RATE), el carrito que
 * le muestra al cliente cuánto va a ganar (`total * 0.1` a mano) y el texto
 * de preguntas frecuentes (el número "10%" tipeado dentro de la oración).
 *
 * Eso significa que bajar la tasa exigía acordarse de los tres. El que se
 * olvidara dejaba al sitio prometiendo una cosa y pagando otra · que es la
 * peor forma de fallar: el cliente lo descubre después de comprar.
 *
 * Ahora el servidor, el carrito y el texto salen todos de acá.
 *
 * Tasa fijada por Emilio el 28-ago-2026: 4% (antes 10%).
 */

/** Cuánto vale una perla en dólares. */
export const PERLA_VALUE_USD = 0.01

/** Qué porción del total vuelve al cliente en perlas. */
export const EARN_RATE = 0.04

/** El mismo número para mostrar en pantalla · nunca se tipea a mano. */
export const PORCENTAJE_GANANCIA = Math.round(EARN_RATE * 100)

/** Tope de descuento pagable con perlas · sobre el subtotal. */
export const SPEND_CAP = 0.5

/** Cuántas perlas deja un pedido de este total. */
export function perlasQueGana(totalUsd: number): number {
  return Math.round((totalUsd * EARN_RATE) / PERLA_VALUE_USD)
}

/**
 * El nombre de cara al cliente · R121 (decision de Emilio 28-ago).
 *
 * Antes se llamaba "perlas" y se mostraba CONTADO: "Tienes 340 perlas".
 * El cliente tenia que hacer la cuenta mental para saber que eso eran
 * $3.40. Ahora se llama tesoro de naufrago y se muestra en DOLARES, que
 * es lo que de verdad le importa: cuanto se ahorra.
 *
 * La unidad interna (1 perla = $0.01) no cambia · sigue viviendo en la
 * base y en el servidor. Lo que cambio es como se lo contamos al cliente.
 */
export const TESORO_NOMBRE = "tesoro de náufrago"

/** Convierte el saldo interno a lo que ve el cliente · "3.40". */
export function tesoroUsd(perlas: number): string {
  return (perlas * PERLA_VALUE_USD).toFixed(2)
}
