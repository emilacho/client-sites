/**
 * La dirección que lleva el QR de un código de Emilio (12-nov · CC3).
 * Siempre al dominio público: la hoja se imprime y el vecino la escanea en su casa.
 */
export const DOMINIO_PUBLICO = "https://naufrago.ec"

export function urlRegistroConCodigo(codigo: string): string {
  return `${DOMINIO_PUBLICO}/residentes?codigo=${encodeURIComponent(codigo)}`
}
