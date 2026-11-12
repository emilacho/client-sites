import "server-only"
/**
 * Llave de un aparato · tarjeta de residente (12-nov · GO Lenovo · CC3).
 *
 * Igual que la pantalla de cocina (`lib/cocina-llave.ts`): el aparato se abre UNA vez con la llave en la
 * dirección, la llave queda guardada en una galleta del navegador y no se pregunta más. La diferencia es
 * que aquí la galleta la lee el servidor (la caja abre la tarjeta con la cámara normal del celular: es una
 * visita de página, no puede mandar cabeceras).
 *
 * Si la variable de entorno no está cargada (o es corta), NO abre para nadie: vale más una caja que no
 * valida que una lista de vecinos a la vista de cualquiera.
 */
import { cookies } from "next/headers"
import { dominioDeGalleta } from "@/lib/residentes-dominio"

export interface Llave {
  /** Variable de entorno con la llave real. */
  variable: string
  /** Nombre de la galleta donde queda guardada. */
  galleta: string
}

/** La caja del local: valida tarjetas y anota visitas. */
export const LLAVE_CAJA: Llave = { variable: "RESIDENTES_CAJA_LLAVE", galleta: "naufrago_caja_llave" }
/** La de Emilio: la lista de vecinos, los códigos y las bajas. */
export const LLAVE_ADMIN: Llave = { variable: "RESIDENTES_ADMIN_LLAVE", galleta: "naufrago_residentes_admin" }

/** Un año: el aparato no vuelve a pedir la llave. */
export const DURACION_GALLETA_S = 60 * 60 * 24 * 365

function llaveReal(l: Llave): string | null {
  const v = process.env[l.variable]
  return v && v.length >= 16 ? v : null
}

/** Comparación en tiempo constante · no filtra la llave por el reloj. */
export function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

/** ¿La llave que viene en la dirección es la correcta? */
export function llaveValida(l: Llave, candidata: string | null | undefined): boolean {
  const real = llaveReal(l)
  if (!real || !candidata) return false
  return igual(candidata, real)
}

/** ¿Este aparato ya tiene la llave guardada? */
export async function aparatoAutorizado(l: Llave): Promise<boolean> {
  const real = llaveReal(l)
  if (!real) return false
  const g = (await cookies()).get(l.galleta)?.value
  return Boolean(g && igual(g, real))
}

export function hayLlaveConfigurada(l: Llave): boolean {
  return llaveReal(l) !== null
}

/**
 * Opciones de la galleta: solo la lee el servidor, solo por https, y viaja al abrir el enlace desde la cámara.
 * Si se entra por naufrago.ec o www.naufrago.ec, se guarda para `.naufrago.ec` y vale en los dos
 * (ver `lib/residentes-dominio.ts`). Una galleta vieja, guardada solo para www, sigue sirviendo allí.
 */
export function opcionesGalleta(host?: string | null) {
  const domain = dominioDeGalleta(host)
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/residentes",
    maxAge: DURACION_GALLETA_S,
    ...(domain ? { domain } : {}),
  }
}
