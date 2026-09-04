/**
 * El horario de la cocina · UN solo lugar · R121 · actualizado R162.
 *
 * Emilio, 04-sep: "se trabaja de 7 de la mañana hasta las 3 de la tarde ·
 * se cierra martes y miércoles · y también cierra la opción de pedir en
 * las horas que estamos cerrados".
 *
 * POR QUÉ ESTE ARCHIVO EXISTE
 * Había TRES horarios distintos conviviendo y ninguno coincidía. Se
 * unificaron en R121. Al ir a cambiarlos hoy aparecieron DOS otra vez:
 *
 *   este archivo            · 11:00 a 22:00   (preguntas frecuentes, voz,
 *                                              reservar hora)
 *   cliente.config.ts       ·  9:00 a 17:00   (el cartel abierto/cerrado)
 *   structured-data.ts      ·  9:00 a 17:00   (lo que ve Google)
 *
 * O sea que el cartel decía "abierto" a las 9:30 y las preguntas
 * frecuentes decían que abría a las 11. Ahora los tres SALEN DE ACÁ ·
 * cambiar el horario es cambiar dos números en este archivo.
 */

/** Hora a la que abre la cocina · 7 = 7 de la mañana. */
export const COCINA_ABRE_H = 7
/** Hora a la que cierra · 15 = 3 de la tarde. */
export const COCINA_CIERRA_H = 15

/** Días cerrados · 0=domingo … 6=sábado. Martes y miércoles. */
export const DIAS_CERRADOS = [2, 3] as const

export const DIAS_ABIERTO = "jueves a lunes"
export const DIAS_CERRADO = "martes y mi\u00e9rcoles"

/** "7:00" · "15:00" */
export const ABRE_TEXTO = `${COCINA_ABRE_H}:00`
export const CIERRA_TEXTO = `${COCINA_CIERRA_H}:00`

/** Una línea lista para mostrar. */
export const HORARIO_TEXTO = `${DIAS_ABIERTO} de ${ABRE_TEXTO} a ${CIERRA_TEXTO}`

/** La zona horaria del local · Ecuador no cambia de hora en el año. */
export const ZONA_HORARIA = "America/Guayaquil"

/**
 * Qué día y hora es AHÍ, en la cocina · no en el reloj de quien mira.
 * Un cliente puede estar en otro país y el que manda es el local.
 */
export function ahoraEnLaCocina(): { dia: number; hora: number; minuto: number } {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date())
  const dias: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  const w = partes.find((p) => p.type === "weekday")?.value ?? "Mon"
  return {
    dia: dias[w] ?? 0,
    hora: Number(partes.find((p) => p.type === "hour")?.value ?? "0"),
    minuto: Number(partes.find((p) => p.type === "minute")?.value ?? "0"),
  }
}

/**
 * ¿La cocina está abierta ahora mismo?
 *
 * Vive acá y no en un componente a propósito: lo usa la pantalla para no
 * dejar pedir, Y el servidor para rechazar un pedido que llegue igual.
 * Una comprobación que sólo vive en la pantalla no es una comprobación.
 */
export function cocinaAbierta(): boolean {
  const { dia, hora } = ahoraEnLaCocina()
  if ((DIAS_CERRADOS as readonly number[]).includes(dia)) return false
  return hora >= COCINA_ABRE_H && hora < COCINA_CIERRA_H
}
