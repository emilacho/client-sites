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

/** Sector o barrio en Olón: mismas reglas que el nombre (2 a 60). */
export const limpiarSector = limpiarNombre

/**
 * Correo opcional. Vacío → «sin correo» (null, válido). Mal escrito → «invalido».
 * Misma regla que la base (algo@algo.algo, máx. 120).
 */
export function limpiarCorreo(crudo: unknown): string | null | "invalido" {
  if (crudo === undefined || crudo === null) return null
  if (typeof crudo !== "string") return "invalido"
  const c = crudo.trim().toLowerCase()
  if (!c) return null
  return c.length <= 120 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c) ? c : "invalido"
}

const DIAS_DEL_MES = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

/**
 * Cumpleaños opcional, sin año: día y mes juntos, o ninguno. 29 de febrero vale.
 * Devuelve {dia, mes}, null (no lo puso) o «invalido».
 */
export function limpiarCumple(diaCrudo: unknown, mesCrudo: unknown): { dia: number; mes: number } | null | "invalido" {
  const vacio = (x: unknown) => x === undefined || x === null || x === ""
  if (vacio(diaCrudo) && vacio(mesCrudo)) return null
  if (vacio(diaCrudo) || vacio(mesCrudo)) return "invalido"
  const dia = Number(diaCrudo), mes = Number(mesCrudo)
  if (!Number.isInteger(dia) || !Number.isInteger(mes) || mes < 1 || mes > 12) return "invalido"
  return dia >= 1 && dia <= DIAS_DEL_MES[mes - 1] ? { dia, mes } : "invalido"
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
