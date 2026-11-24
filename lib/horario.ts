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
/** R173 · Emilio, 04-nov: abre el local de verdad, por un rato, para que un socio en Guayaquil haga un pedido de ensayo.
 *  Se cierra SOLO a esta hora (no hay que acordarse): pasada, vuelve el horario de siempre. Para cerrar antes, poner "". */
export const APERTURA_TEMPORAL_DESDE = "2026-11-04T18:00:00Z"
export const APERTURA_TEMPORAL_HASTA = "2026-11-04T21:04:00Z"

/** 24-nov · Emilio: «apagar los pedidos de naufrago.ec hasta el miércoles» y avisar la fecha de inauguración.
 *  Antes de este instante NO se puede pedir, aunque sea día y hora de atención. Pasado, se abre SOLO
 *  y vuelve el horario de siempre: mañana nadie tiene que tocar nada. Para quitarlo, poner "". */
export const INAUGURACION = "2026-11-25T12:00:00Z" // miércoles 25-nov · 7:00 en Guayaquil (UTC−5)

/** Fechas de la cocina (AAAA-MM-DD) que abren aunque caigan en DIAS_CERRADOS. La inauguración cae en miércoles. */
export const DIAS_EXTRA_ABIERTOS: readonly string[] = ["2026-11-25"]

/** La fecha AHÍ, en la cocina · "2026-11-25". */
export function fechaEnLaCocina(ms: number = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms))
}

/** ¿Todavía no inauguramos? */
export function antesDeLaInauguracion(ms: number = Date.now()): boolean {
  return Boolean(INAUGURACION) && ms < Date.parse(INAUGURACION)
}

/** Sale de INAUGURACION, no se escribe a mano · { dia: "miércoles 25 de noviembre", hora: "7:00" }. */
export function textoDeLaInauguracion(): { dia: string; hora: string } {
  const d = new Date(INAUGURACION)
  const dia = new Intl.DateTimeFormat("es-EC", {
    timeZone: ZONA_HORARIA,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d).replace(",", "")
  // «7:00», no «07:00»: el número de la hora va sin cero, como en el resto de la web.
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA_HORARIA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d)
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "0"
  const hora = `${Number(parte("hour"))}:${parte("minute")}`
  return { dia, hora }
}

/** El aviso de una línea · «Inauguramos el miércoles 25 de noviembre · pedidos desde las 7:00». */
export function avisoDeLaInauguracion(): string {
  const { dia, hora } = textoDeLaInauguracion()
  return `Inauguramos el ${dia} · pedidos desde las ${hora}`
}

/** Lo que lee quien intenta pedir con la cocina cerrada (pantalla y servidor dicen lo mismo). */
export function mensajeDeCerrado(ms: number = Date.now()): string {
  if (antesDeLaInauguracion(ms)) return `${avisoDeLaInauguracion()}. ¡Te esperamos!`
  return `Estamos cerrados · atendemos ${HORARIO_TEXTO}. ¡Te esperamos!`
}

export function cocinaAbierta(): boolean {
  const ahoraMs = Date.now()
  if (APERTURA_TEMPORAL_HASTA && ahoraMs >= Date.parse(APERTURA_TEMPORAL_DESDE) && ahoraMs < Date.parse(APERTURA_TEMPORAL_HASTA)) return true
  if (antesDeLaInauguracion(ahoraMs)) return false
  const { dia, hora } = ahoraEnLaCocina()
  const diaExtra = DIAS_EXTRA_ABIERTOS.includes(fechaEnLaCocina(ahoraMs))
  if (!diaExtra && (DIAS_CERRADOS as readonly number[]).includes(dia)) return false
  return hora >= COCINA_ABRE_H && hora < COCINA_CIERRA_H
}
