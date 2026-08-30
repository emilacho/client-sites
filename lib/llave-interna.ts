import "server-only"
/**
 * La llave de las rutas internas · R146.
 *
 * Hay rutas que existen sólo para que las llame otra parte de nuestro
 * propio sistema, no un navegador. `courier/order-from-confirmed` es
 * el caso: nació para que la llamara el aviso de WhatsApp cuando el
 * cliente confirma, y despacha un motorizado REAL con orden de cobrar.
 *
 * Estaba publicada al mundo sin pedir nada. Cualquiera con un código
 * de pedido válido podía mandar un motorizado a la puerta de un
 * cliente, y eso se factura.
 *
 * Mismo criterio que la llave de la cocina: si la variable no está
 * cargada, la ruta NO abre para nadie. Vale más un flujo caído que uno
 * que despacha para cualquiera.
 */
import { timingSafeEqual } from "node:crypto"

export const CABECERA_INTERNA = "x-naufrago-interna"

function llaveReal(): string | null {
  const v = process.env.NAUFRAGO_LLAVE_INTERNA
  return v && v.length >= 24 ? v : null
}

/** Comparación en tiempo constante · no filtra la llave por el reloj. */
function igual(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

/** ¿Esta llamada viene de adentro de nuestro propio sistema? */
export function llamadaInterna(req: Request): boolean {
  const real = llaveReal()
  if (!real) return false
  const dada = req.headers.get(CABECERA_INTERNA)
  return Boolean(dada && igual(dada, real))
}

/** Para armar la cabecera del lado que llama. */
export function cabecerasInternas(): Record<string, string> {
  const real = llaveReal()
  return real ? { [CABECERA_INTERNA]: real } : {}
}
