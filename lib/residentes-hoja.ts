/**
 * La dirección que lleva el QR de un código de Emilio (12-nov · CC3).
 * Siempre al dominio público: la hoja se imprime y el vecino la escanea en su casa.
 */
import { DOMINIO_RESIDENTES } from "@/lib/residentes-dominio"

export function urlRegistroConCodigo(codigo: string): string {
  return `${DOMINIO_RESIDENTES}/residentes?codigo=${encodeURIComponent(codigo)}`
}
