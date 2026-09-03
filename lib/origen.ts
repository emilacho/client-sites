import "server-only"
import { cliente } from "@/cliente.config"
/**
 * La dirección de esta misma publicación · R146.
 *
 * Hay partes del sistema que se llaman a sí mismas por HTTP (el aviso
 * de WhatsApp dispara el despacho · el aviso del motorizado dispara la
 * notificación al cliente). Cada una armaba la dirección por su cuenta
 * leyendo `NEXT_PUBLIC_APP_URL`, con planes B distintos y todos malos:
 *
 *   whatsapp/incoming        -> "http://localhost:3000"
 *   courier/webhook          -> "http://localhost:3000"
 *   order-from-confirmed     -> "https://naufrago.delivery"
 *   notifications/order-status -> "https://naufrago.delivery"
 *
 * Y `NEXT_PUBLIC_APP_URL` NO está cargada en producción · se verificó
 * contra la plataforma. O sea que esas llamadas salían a un servidor
 * local que no existe, o a un dominio que nunca se compró, y como todas
 * son "dispara y olvida" con el error tragado, fallaban en silencio.
 *
 * Acá se resuelve en un solo lugar y con un plan B que sí sirve:
 * cuando corre en la plataforma, ella misma publica la dirección de la
 * publicación (`VERCEL_URL`), así funciona igual en producción y en
 * vista previa sin cargar nada a mano.
 */
export function origenPropio(): string {
  // La dirección de ESTA publicación va primero, a propósito. Es una
  // llamada de la app a sí misma: una vista previa tiene que llamarse a
  // sí misma, no al sitio público · si no, probar un cambio dispararía
  // efectos en producción.
  const dePlataforma = process.env.VERCEL_URL
  if (dePlataforma) return `https://${dePlataforma}`
  const declarado =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL
  if (declarado) return declarado.replace(/\/+$/, "")
  return "http://localhost:3000"
}

/**
 * La dirección PÚBLICA del cliente · la que ve la gente.
 *
 * Es distinta de `origenPropio()` a propósito. Un enlace que se le manda
 * al cliente por WhatsApp tiene que decir naufrago.ec, no la dirección
 * interna de una publicación. Antes había dos enlaces armados con
 * "https://naufrago.delivery" — un dominio que NUNCA se compró y que
 * hoy ni siquiera resuelve. El cliente recibía un enlace muerto.
 */
export function origenPublico(): string {
  return cliente.domain.replace(/\/+$/, "")
}
