/**
 * La ubicación de Náufrago · UN solo lugar · R105.
 *
 * Antes de esto la ubicación estaba escrita a mano en cuatro archivos, y no
 * coincidían entre sí: el mapa del cliente abría en un punto, los datos que
 * lee Google decían otro, y el punto de retiro del repartidor un tercero.
 * Los tres apuntaban a Olón, que era el dato de PRUEBA con el que se armó
 * la página · la cocina real está en Guayaquil, a 103 km de ahí.
 *
 * Regla: nadie escribe coordenadas ni direcciones a mano. Todo sale de acá.
 *
 * Dato de origen · Emilio, 25-ago-2026: 2°08'45.1"S 79°54'05.1"W.
 * El nombre de la calle y el sector salen de resolver esas coordenadas en
 * el mapa (Avenida 8 NO · Urdenor 1 · Tarqui) y Emilio los aprobó.
 */

/** La cocina que despacha · de acá sale el repartidor. */
export const COCINA = {
  /** 2°08'45.1"S · en grados decimales. */
  lat: -2.1458611,
  /** 79°54'05.1"W · en grados decimales. */
  lng: -79.9014167,
  calle: "Avenida 8 NO",
  sector: "Urdenor 1",
  parroquia: "Tarqui",
  ciudad: "Guayaquil",
  provincia: "Guayas",
  codigoPostal: "090505",
  pais: "EC",
  /** Una línea, para mostrar. */
  direccionCorta: "Avenida 8 NO · Urdenor 1 · Guayaquil",
  /** Completa, para documentos y para el repartidor. */
  direccionCompleta:
    "Avenida 8 NO, Urdenor 1, Tarqui, Guayaquil, Guayas, Ecuador",
} as const

/**
 * El restaurante de Olón · SEGUNDO local (decisión de Emilio 25-ago: se
 * queda). NO despacha: el reparto sale siempre de la cocina de Guayaquil.
 * Se conserva porque la marca lo nombra y hay clientes de esa zona.
 */
export const RESTAURANTE_OLON = {
  ciudad: "Olón",
  provincia: "Santa Elena",
  etiqueta: "restaurante Olón, Sta Elena",
} as const
