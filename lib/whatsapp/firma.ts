import "server-only"
import crypto from "node:crypto"

/**
 * ¿Este mensaje de WhatsApp lo mandó de verdad el proveedor? · R166
 *
 * EL AGUJERO QUE CIERRA
 * La dirección que recibe los mensajes de WhatsApp es pública y hasta
 * hoy le creía a cualquiera. El mensaje trae un campo con el número de
 * quien escribe, y ese campo lo escribe quien llama · no hay nada que
 * lo ate a un teléfono real.
 *
 * Con eso, cualquiera que supiera la dirección podía:
 *   · hacerse pasar por el dueño y cambiar los jugos del día
 *   · hacerse pasar por un cliente y cambiarle la dirección de entrega
 *     a un pedido que está esperando ubicación
 *
 * Twilio firma cada aviso: arma un resumen con la dirección que llamó
 * más todos los campos del formulario ordenados alfabéticamente, y lo
 * sella con la clave de la cuenta -que sólo tenemos nosotros y ellos-.
 * Si el resumen no coincide, el mensaje no salió de ellos.
 *
 * SIN CLAVE, NO SE ATIENDE
 * Si falta la clave de la cuenta no se puede verificar nada, y un aviso
 * que no se puede verificar no se atiende. Antes se hubiera dicho "que
 * pase igual, total es sólo WhatsApp" · pero por acá se cambian jugos y
 * direcciones de entrega.
 */

/** La dirección tal como la llamó el proveedor · con la que él firmó. */
function direccionLlamada(req: Request): string {
  const url = new URL(req.url)
  const h = req.headers
  // Detrás del servidor de publicación, req.url llega con el nombre
  // interno y en http · el proveedor firmó con el nombre público.
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? url.host
  const proto = h.get("x-forwarded-proto") ?? "https"
  return `${proto}://${host}${url.pathname}${url.search}`
}

/** La dirección con la que se verificó · para poder diagnosticar. */
export function direccionVerificada(req: Request): string {
  return direccionLlamada(req)
}

/**
 * Arma el mismo texto que armó el proveedor y compara los sellos.
 *
 * `cuerpo` es el texto crudo del formulario · tiene que ser el mismo
 * que se va a leer después, sin re-pedirlo (el cuerpo de un pedido se
 * puede leer una sola vez).
 */
export function firmaValida(req: Request, cuerpo: string): boolean {
  const clave = process.env.TWILIO_AUTH_TOKEN
  if (!clave) return false

  const sello = req.headers.get("x-twilio-signature")
  if (!sello) return false

  const campos = new URLSearchParams(cuerpo)
  // Alfabético por nombre de campo · si un campo viene repetido, sus
  // valores se pegan en el orden en que llegaron. Así lo arma Twilio.
  const nombres = [...new Set([...campos.keys()])].sort()
  let texto = direccionLlamada(req)
  for (const n of nombres) {
    for (const v of campos.getAll(n)) texto += n + v
  }

  const propio = crypto
    .createHmac("sha1", clave)
    .update(Buffer.from(texto, "utf-8"))
    .digest("base64")

  // Comparación de largo constante · una comparación normal revela, por
  // el tiempo que tarda, cuántos caracteres acertó quien prueba.
  const a = Buffer.from(propio)
  const b = Buffer.from(sello)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
