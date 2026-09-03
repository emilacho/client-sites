import "server-only"
/**
 * El teléfono, en una sola forma · R152.
 *
 * EL PROBLEMA
 * La misma persona tenía dos identidades en la base:
 *
 *   pedidos          customer_phone  = "0997744288"   ← tal cual lo escribió
 *   tesoro (perlas)  phone           = "593997744288" ← normalizado
 *   fichas cliente   whatsapp_e164   = a veces uno, a veces otro
 *
 * Todo el sistema normaliza a la forma internacional ANTES de guardar
 * —hay dieciséis copias de la misma función haciéndolo— menos la ruta
 * que crea el pedido, que guardaba el número crudo.
 *
 * Consecuencia: un pedido y las perlas de esa misma persona no se
 * cruzan. Y desde R151, el camino "tengo el enlace de seguimiento"
 * devuelve el teléfono del pedido para buscar la ficha del cliente:
 * con formatos distintos, esa búsqueda no encuentra nunca nada.
 *
 * LAS DIECISÉIS COPIAS · saldado en R153
 * Eran dieciséis libretas con la misma regla escrita a mano. Se
 * compararon una por una antes de tocarlas: quince idénticas al
 * carácter, y la de `subscribers/signup` distinta sólo por llevar
 * comentarios adentro. Ninguna se comportaba diferente, así que
 * unificarlas no cambió nada · sólo quitó la trampa de que alguien
 * corrigiera una y desalineara las otras quince en silencio.
 *
 * Si mañana hay que aceptar números de otro país, se cambia ACÁ y las
 * dieciséis quedan alineadas solas.
 */

/**
 * Deja el número en la forma que usa el resto del sistema.
 * Devuelve null si no puede ser un teléfono de verdad.
 *
 * Misma regla que las dieciséis copias, para no introducir un
 * comportamiento nuevo por la puerta de atrás:
 *   0997744288  → 593997744288   (celular ecuatoriano con el 0 al frente)
 *   997744288   → 593997744288   (sin el 0)
 *   +593997744288 → 593997744288
 */
export function telefonoCanonico(crudo: string | null | undefined): string | null {
  const digitos = (crudo ?? "").replace(/\D/g, "")
  if (digitos.length < 8 || digitos.length > 15) return null
  if (digitos.startsWith("0")) return `593${digitos.slice(1)}`
  if (digitos.length === 9 && digitos.startsWith("9")) return `593${digitos}`
  return digitos
}
