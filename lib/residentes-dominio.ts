/**
 * El dominio de la tarjeta de residente (12-nov · CC3 · arreglo «www vs sin www»).
 *
 * `naufrago.ec` y `www.naufrago.ec` sirven el mismo sitio pero el navegador los trata como dos casas
 * distintas: una galleta guardada en una no viaja a la otra. Por eso:
 * - todo QR y todo enlace de residentes apunta SIEMPRE a `www` (no depende de cómo esté escrito
 *   `NEXT_PUBLIC_SITE_URL`, que hoy es `https://naufrago.ec`);
 * - las galletas de la caja y de Emilio se guardan para `.naufrago.ec`, así valen en los dos.
 */

/** El dominio canónico de residentes. */
export const DOMINIO_RESIDENTES = "https://www.naufrago.ec"

/** El dominio de las galletas cuando el sitio se abre desde naufrago.ec o un subdominio suyo. */
export const DOMINIO_GALLETA = ".naufrago.ec"

/**
 * El `domain` de la galleta para quien entra por `host`. Fuera de naufrago.ec (vista previa de Vercel,
 * localhost) no lleva dominio: el navegador rechazaría una galleta para otro dominio.
 */
export function dominioDeGalleta(host: string | null | undefined): string | undefined {
  const h = (host ?? "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "")
  return h === "naufrago.ec" || h.endsWith(".naufrago.ec") ? DOMINIO_GALLETA : undefined
}
