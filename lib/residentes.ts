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

/**
 * Cédula OBLIGATORIA: solo números, de 6 a 15 dígitos. Se quitan espacios y guiones. No se valida el
 * dígito verificador: valen cédulas de otros países y pasaportes numéricos. Misma regla que la base.
 */
export function limpiarCedula(crudo: unknown): string | null {
  if (typeof crudo !== "string") return null
  const c = crudo.replace(/[\s-]/g, "")
  return /^[0-9]{6,15}$/.test(c) ? c : null
}

/**
 * Fecha de nacimiento opcional (día, mes y año): los tres juntos, o ninguno.
 * Tiene que existir (29-feb solo en bisiesto), desde 1900 y no en el futuro (día de Ecuador).
 * Devuelve «AAAA-MM-DD», null (no la puso) o «invalido».
 */
export function limpiarFechaNacimiento(
  diaCrudo: unknown,
  mesCrudo: unknown,
  anioCrudo: unknown,
  hoy: Date = new Date(),
): string | null | "invalido" {
  const vacio = (x: unknown) => x === undefined || x === null || x === ""
  const partes = [diaCrudo, mesCrudo, anioCrudo]
  if (partes.every(vacio)) return null
  if (partes.some(vacio)) return "invalido"
  const [dia, mes, anio] = partes.map(Number)
  if (![dia, mes, anio].every(Number.isInteger) || anio < 1900 || mes < 1 || mes > 12 || dia < 1) return "invalido"
  const f = new Date(Date.UTC(anio, mes - 1, dia))
  if (f.getUTCFullYear() !== anio || f.getUTCMonth() !== mes - 1 || f.getUTCDate() !== dia) return "invalido"
  const iso = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`
  return iso <= diaEcuador(hoy) ? iso : "invalido"
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
