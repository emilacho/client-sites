import "server-only"
/**
 * El precio lo pone la casa, no el cliente · R154.
 *
 * EL AGUJERO
 * El servidor "recalculaba" el subtotal... a partir de los precios que
 * mandaba el navegador. Recalcular la multiplicación no sirve de nada si
 * el precio de cada plato lo escribe quien compra.
 *
 * Comprobado contra el sitio publicado antes de este arreglo:
 *
 *   10 encebollados a su precio real ($4)  ->  subtotal $40.00
 *   10 encebollados a $0.01                ->  subtotal $ 0.10   ← aceptado
 *
 * Y desde R144 esa cifra es la que se le ordena cobrar al motorizado en
 * la puerta. Con la pasarela encendida, sería la que se le cobra a la
 * tarjeta. Cuarenta dólares de comida por dos con sesenta.
 *
 * CÓMO SE RECONSTRUYE
 * El identificador de cada línea ya trae todo lo necesario · lo arma la
 * carta al agregar al carrito:
 *
 *   "encebollado-naufrago"                        plato sin nada
 *   "encebollado-naufrago::tg-extra-huevo"        con un extra
 *   "cola-grande::coca-cola"                      con variante
 *   "jugo::naranja"                               con sabor del día
 *
 * Así que el precio se rehace desde la carta del servidor:
 *   precio del plato + los extras que sí cuestan
 *
 * Lo que NO suma nada, a propósito:
 *   · quitar un ingrediente ("sin cebolla") · no descuenta
 *   · el sabor del día · la tabla de sabores no lleva precio, sólo nombre
 */
import { MENU_ITEMS } from "@/lib/v2/naufrago-content"

/**
 * Los regalos · valen CERO y no están en la carta.
 *
 * REGRESIÓN QUE ESTO ARREGLA (introducida por mí en R154)
 * La ruleta agrega el premio ganado al carrito como una línea normal a
 * $0 (`RuletaModal.tsx:411`). Esas líneas NO viven en la carta, así que
 * al empezar a rechazar todo id desconocido dejé sin poder pedir a
 * cualquiera que ganara la ruleta. Estuvo roto en producción desde que
 * se publicó R154.
 *
 * Se aceptan a $0 y sólo estos tres. Como valen cero, aceptarlos no
 * puede rebajar una cuenta · lo único en juego es el producto en sí, y
 * por eso van con tope de una unidad.
 */
const REGALOS: Record<string, { nombre: string; topeUnidades: number }> = {
  "prize-chifle": { nombre: "Chifle · regalo", topeUnidades: 1 },
  "prize-pan": { nombre: "Pan · regalo", topeUnidades: 1 },
  "prize-cola": { nombre: "Cola · regalo", topeUnidades: 1 },
}

export function esRegalo(idDeLinea: string): boolean {
  return idDeLinea in REGALOS
}

export interface PrecioDeLinea {
  /** El precio que manda la casa · null si el plato no existe. */
  precioUsd: number | null
  /** Para poder decir qué no se reconoció. */
  motivo?: string
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

export function precioRealDeLinea(idDeLinea: string): PrecioDeLinea {
  if (esRegalo(idDeLinea)) return { precioUsd: 0 }
  const [idPlato, sufijo] = idDeLinea.split("::")
  const plato = MENU_ITEMS.find((i) => i.id === idPlato)
  if (!plato) return { precioUsd: null, motivo: `plato_desconocido:${idPlato}` }

  let precio = plato.priceUsd
  if (!sufijo) return { precioUsd: redondear(precio) }

  for (const idMod of sufijo.split("+")) {
    if (!idMod) continue

    // Quitar un ingrediente · no cambia el precio.
    if (idMod.startsWith("tg-sin-")) continue

    // Agregar un ingrediente · suma lo que diga la carta, NUNCA lo que
    // diga el navegador.
    if (idMod.startsWith("tg-extra-")) {
      const idToggle = idMod.slice("tg-extra-".length)
      const toggle = plato.ingredientToggles?.find((t) => t.id === idToggle)
      if (!toggle) {
        return { precioUsd: null, motivo: `extra_desconocido:${idMod}` }
      }
      precio += toggle.extraPriceDelta ?? 0
      continue
    }

    // Variante fija de la carta · ej. la marca de la cola.
    const variante = plato.variants?.find((v) => v.id === idMod)
    if (variante) {
      precio += variante.priceDelta
      continue
    }

    // Variante del día · viene de una tabla que sólo guarda nombres, sin
    // precio. Se acepta sin sumar. Si el plato NO admite variantes del
    // día, el identificador es inventado y se rechaza.
    if (plato.dynamicVariantsKey) continue

    return { precioUsd: null, motivo: `modificador_desconocido:${idMod}` }
  }

  return { precioUsd: redondear(precio) }
}

export interface LineaPedida {
  id: string
  priceUsd: number
  qty: number
}

export interface RevisionDePrecios {
  ok: boolean
  /** El subtotal según la casa · el único que se debe usar. */
  subtotalUsd: number
  /** Qué líneas no cuadran · vacío si todo bien. */
  problemas: string[]
}

/**
 * Rehace el subtotal con los precios de la casa y avisa si el navegador
 * mandó otra cosa.
 *
 * Se RECHAZA la diferencia en vez de corregirla en silencio: si el
 * cliente vio otro número en pantalla, cobrarle uno distinto -para
 * arriba o para abajo- es peor que pedirle que vuelva a armar el pedido.
 */
export function revisarPrecios(
  lineas: LineaPedida[],
  /** R157 · el ÚNICO regalo autorizado para este pedido · null = ninguno.
   *  Antes (R156) los regalos se aceptaban a ciegas para no dejar sin
   *  pedir a quien ganaba la ruleta · eso quedó anotado como deuda y se
   *  salda acá: ahora hay que haber girado o haber llegado al tope de
   *  perlas. */
  regaloAutorizado: string | null = null,
): RevisionDePrecios {
  let subtotal = 0
  const problemas: string[] = []

  for (const l of lineas) {
    if (esRegalo(l.id)) {
      if (l.id !== regaloAutorizado) {
        problemas.push(`regalo_sin_ganar:${l.id}`)
        continue
      }
      if (l.qty > REGALOS[l.id].topeUnidades) {
        problemas.push(`regalo_con_exceso:${l.id}:${l.qty}`)
        continue
      }
    }
    const { precioUsd, motivo } = precioRealDeLinea(l.id)
    if (precioUsd === null) {
      problemas.push(motivo ?? `linea_invalida:${l.id}`)
      continue
    }
    // Un centavo de tolerancia por el redondeo de la pantalla.
    if (Math.abs(precioUsd - l.priceUsd) > 0.011) {
      problemas.push(
        `precio_alterado:${l.id}:pantalla=${l.priceUsd}:carta=${precioUsd}`,
      )
    }
    subtotal += precioUsd * l.qty
  }

  return { ok: problemas.length === 0, subtotalUsd: redondear(subtotal), problemas }
}
