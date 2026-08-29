import "server-only"
/**
 * La llave de la pantalla de cocina · R132.
 *
 * La pantalla vive en una tablet que se queda prendida todo el día en el
 * local. No tiene sentido pedirle usuario y contraseña a alguien que está
 * con las manos en la cocina: se abre UNA vez con la llave en la
 * dirección (`/cocina?llave=...`), queda guardada en el aparato y no se
 * pregunta más.
 *
 * La llave vive en `COCINA_LLAVE` (variable de entorno). Si no está
 * cargada, la pantalla NO abre para nadie · vale más una cocina sin
 * pantalla que los pedidos de los clientes a la vista de cualquiera que
 * adivine la dirección.
 */
import { cookies } from "next/headers"

export const NOMBRE_COOKIE = "cocina_llave"

function llaveReal(): string | null {
  const v = process.env.COCINA_LLAVE
  return v && v.length >= 12 ? v : null
}

/** Comparación en tiempo constante · no filtra la llave por el reloj. */
function igual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let dif = 0
  for (let i = 0; i < a.length; i++) dif |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return dif === 0
}

/** ¿Este pedido viene de la tablet de la cocina? */
export async function cocinaAutorizada(cabeceraLlave?: string | null): Promise<boolean> {
  const real = llaveReal()
  if (!real) return false
  if (cabeceraLlave && igual(cabeceraLlave, real)) return true
  const galleta = (await cookies()).get(NOMBRE_COOKIE)?.value
  return Boolean(galleta && igual(galleta, real))
}

/** ¿La llave que viene en la dirección es la correcta? */
export function llaveValida(candidata: string | null | undefined): boolean {
  const real = llaveReal()
  if (!real || !candidata) return false
  return igual(candidata, real)
}

export function hayLlaveConfigurada(): boolean {
  return llaveReal() !== null
}
