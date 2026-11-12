import "server-only"
import { randomBytes, randomInt } from "node:crypto"
/**
 * Tarjeta de residente de Olón · utilidades compartidas (registro, tarjeta, caja y lista).
 *
 * - Código de Emilio: «NAU-» + 6 caracteres de un alfabeto SIN los que se confunden (0/O, 1/I/L).
 *   31^6 ≈ 887 millones de combinaciones; con el límite de intentos no se adivina.
 * - Ficha: 18 bytes al azar en base64url (24 caracteres). Es lo que lleva el QR; no se deduce
 *   del número ni del teléfono.
 * - Día de Ecuador: la tarjeta vale una vez por día de America/Guayaquil (00:00 a 23:59).
 *
 * Las mismas reglas están en la migración 202611120300 (checks de formato); si cambias una, cambia la otra.
 */

export const ALFABETO_CODIGO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
export const LARGO_CODIGO = 6
const RE_CODIGO = /^NAU-[2-9A-HJKMNP-Z]{6}$/
const RE_FICHA = /^[A-Za-z0-9_-]{24}$/

/** Lo que escribe o escanea el vecino → «NAU-XXXXXX», o null si no puede ser un código. */
export function normalizarCodigo(crudo: unknown): string | null {
  if (typeof crudo !== "string") return null
  let s = crudo.toUpperCase().replace(/[^A-Z0-9]/g, "")
  if (s.startsWith("NAU")) s = s.slice(3)
  if (s.length !== LARGO_CODIGO) return null
  const codigo = `NAU-${s}`
  return RE_CODIGO.test(codigo) ? codigo : null
}

/** Un código nuevo al azar (lo usa la lista de Emilio para «Generar códigos»). */
export function generarCodigo(): string {
  let s = ""
  for (let i = 0; i < LARGO_CODIGO; i++) s += ALFABETO_CODIGO[randomInt(ALFABETO_CODIGO.length)]
  return `NAU-${s}`
}

/** La ficha secreta de una tarjeta nueva. */
export function generarFicha(): string {
  return randomBytes(18).toString("base64url")
}

export function esFicha(s: unknown): s is string {
  return typeof s === "string" && RE_FICHA.test(s)
}

/** Nombre limpio (espacios de más fuera) o null si no sirve. Mismo rango que la base: 2 a 60. */
export function limpiarNombre(crudo: unknown): string | null {
  if (typeof crudo !== "string") return null
  const n = crudo.replace(/\s+/g, " ").trim()
  return n.length >= 2 && n.length <= 60 ? n : null
}

/** «R-0007» · el número visible de la tarjeta. */
export function numeroVisible(numero: number): string {
  return `R-${String(numero).padStart(4, "0")}`
}

/** Día de calendario en Ecuador («2026-11-12»), para la regla de una vez al día. */
export function diaEcuador(fecha: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(fecha)
}
