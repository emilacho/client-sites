/**
 * El horario de la cocina · UN solo lugar · R121.
 *
 * Habia TRES horarios distintos conviviendo en el sitio, y no coincidian:
 *   - preguntas frecuentes y el panel de contacto · "jueves a lunes, 9 AM a 5 PM"
 *   - el asistente de voz · "estamos abiertos hoy hasta las 22:00"
 *   - la pantalla de reservar hora · 11:00 a 22:00
 *
 * El tercero no es un texto: es el que MANDA. Esa pantalla RECHAZA cualquier
 * hora fuera de 11-22. O sea que el sitio le prometia al cliente 9 AM y
 * despues le negaba el pedido, y le decia que cerraba a las 5 PM cuando en
 * realidad seguia tomando pedidos hasta las 10 de la noche.
 *
 * Se unifico en lo que el sistema YA HACE (11:00-22:00), no en lo que decia
 * un texto que no controlaba nada. Los dias salen de las preguntas
 * frecuentes, que era el unico lugar donde estaban escritos.
 *
 * Si el horario real de la cocina es otro, se cambia ACA y se corrige en
 * todas las pantallas a la vez.
 */

export const COCINA_ABRE_H = 11
export const COCINA_CIERRA_H = 22

export const DIAS_ABIERTO = "jueves a lunes"
export const DIAS_CERRADO = "martes y mi\u00e9rcoles"

/** "11:00" · "22:00" */
export const ABRE_TEXTO = `${COCINA_ABRE_H}:00`
export const CIERRA_TEXTO = `${COCINA_CIERRA_H}:00`

/** Una linea lista para mostrar. */
export const HORARIO_TEXTO = `${DIAS_ABIERTO} de ${ABRE_TEXTO} a ${CIERRA_TEXTO}`
