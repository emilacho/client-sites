import "server-only"
/**
 * ADAPTADOR · R106 · este archivo YA NO habla con PedidosYa.
 *
 * Historia corta: en julio se reescribió el proveedor real contra la API
 * de verdad (`pedidosya-courier.ts`, con prueba en vivo), pero las cuatro
 * rutas de `/api/courier/*` siguieron importando ESTE archivo — el andamio
 * de R74, hecho de suposiciones y con modo simulado adentro. Resultado: el
 * código real estaba escrito y NUNCA se ejecutaba. La página devolvía
 * `MOCK-QUOTE-…` y un enlace de seguimiento a un dominio inexistente.
 *
 * Este archivo pasa a ser una CAPA DE TRADUCCIÓN: conserva las firmas
 * viejas que usan las rutas y por dentro llama al proveedor real. Se hizo
 * así a propósito y no por comodidad: las formas viejas (`orderId`,
 * `status`, `lines`) están cableadas a nombres de columna en ~12 puntos
 * del camino del dinero, y reescribir eso en el mismo cambio que enciende
 * la API real mezcla dos riesgos distintos.
 *
 * PENDIENTE declarado · migrar las 4 rutas a `getCourierProvider()` del
 * registro y borrar este archivo. Es un cambio mecánico, hoy no se hace.
 *
 * Lo que se fue con el andamio: el MODO SIMULADO. Ya no existe. Si faltan
 * credenciales, la ruta devuelve 503 con el nombre de la variable — falla
 * a la vista, no con un precio inventado.
 */
import { pedidosYaCourier } from "./pedidosya-courier"
import type { DispatchItem } from "./provider"

/* ─── Formas heredadas · las consumen las rutas de /api/courier ─── */

export interface QuoteParams {
  dropoff: {
    street: string
    detail?: string
    countryCode?: string
    latitude?: number
    longitude?: number
  }
  cartTotalUsd: number
  itemCount: number
}

export interface QuoteResult {
  quoteToken: string
  priceUsd: number
  etaMinutes: number
  expiresAt: string
  raw: unknown
}

export interface CreateOrderParams {
  quoteToken: string
  dropoff: QuoteParams["dropoff"]
  customer: { name: string; phone: string; email?: string }
  lines: Array<{ name: string; qty: number; priceUsd: number }>
  notes?: string
  /** Nuestro código de pedido · viaja a PedidosYa para cruzarlo en su panel. */
  externalReference?: string
}

export interface CreateOrderResult {
  orderId: string
  trackingUrl?: string
  status: string
  /** R107 · precio real del envío confirmado por el proveedor. */
  priceUsd?: number
  /** R107 · minutos hasta la entrega, según el proveedor. */
  etaMinutes?: number
  raw: unknown
}

function paisPorDefecto(): string {
  return process.env.PEDIDOSYA_COURIER_COUNTRY_CODE ?? "EC"
}

function comoDireccion(d: QuoteParams["dropoff"]) {
  return {
    street: d.street,
    detail: d.detail ?? null,
    countryCode: d.countryCode ?? paisPorDefecto(),
    latitude: d.latitude,
    longitude: d.longitude,
  }
}

/**
 * La cotización necesita el detalle del pedido y acá sólo llega el total
 * y el conteo. Se manda UNA línea agregada · a PedidosYa le sirve para
 * dimensionar al motorizado, no para cobrar por artículo.
 */
function comoArticulosAgregados(
  cartTotalUsd: number,
  itemCount: number,
): DispatchItem[] {
  const cantidad = Math.max(1, itemCount)
  return [
    {
      description: `Pedido Náufrago · ${cantidad} ítem(s)`,
      quantity: cantidad,
      priceUsd: cantidad > 0 ? cartTotalUsd / cantidad : cartTotalUsd,
    },
  ]
}

export async function getDeliveryQuote(
  params: QuoteParams,
): Promise<QuoteResult> {
  const r = await pedidosYaCourier.getQuote({
    dropoff: comoDireccion(params.dropoff),
    items: comoArticulosAgregados(params.cartTotalUsd, params.itemCount),
    cartTotalUsd: params.cartTotalUsd,
  })
  return {
    quoteToken: r.quoteToken,
    priceUsd: r.priceUsd,
    etaMinutes: r.etaMinutes,
    expiresAt: r.expiresAt,
    raw: r.raw,
  }
}

export async function createOrder(
  params: CreateOrderParams,
): Promise<CreateOrderResult> {
  const r = await pedidosYaCourier.dispatch({
    quoteToken: params.quoteToken,
    dropoff: comoDireccion(params.dropoff),
    customer: {
      name: params.customer.name,
      phone: params.customer.phone,
      email: params.customer.email ?? null,
    },
    items: params.lines.map((l) => ({
      description: `${l.qty}× ${l.name}`,
      quantity: l.qty,
      priceUsd: l.priceUsd,
    })),
    notes: params.notes ?? null,
    externalReference: params.externalReference,
  })
  return {
    orderId: r.providerOrderId,
    trackingUrl: r.trackingUrl,
    status: r.providerStatus,
    priceUsd: r.priceUsd,
    etaMinutes: r.etaMinutes,
    raw: r.raw,
  }
}

/**
 * Las rutas llaman con UNA firma suelta (así era el andamio). PedidosYa
 * NO firma con HMAC: manda una clave estática en los encabezados. Se
 * traduce a la forma que espera el proveedor real.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  return pedidosYaCourier.verifyWebhookSignature(rawBody, {
    authorization: signature,
    "x-api-key": signature,
  })
}

/**
 * R107.3 · lectura del aviso de estado con la forma REAL.
 *
 * El andamio de R74 SUPUSO `{event, orderId, status, timestamp, payload}`
 * y la ruta validaba contra eso. PedidosYa manda otra cosa:
 *   { topic, id, referenceId, generated, transmitted,
 *     data: { status, cancelCode?, cancelReason? } }
 * con `id` = el id del envío. Un aviso REAL habría sido rechazado con
 * 400 · y el síntoma habría sido "PedidosYa no manda avisos".
 *
 * Devuelve los nombres viejos para no tocar todo lo que cuelga de la
 * ruta, y agrega `mappedStatus`, que es el estado traducido a los 8
 * valores que acepta nuestra tabla.
 */
export function parseWebhookEvent(rawBody: string): {
  event: string
  orderId: string
  status: string
  mappedStatus: string | null
  timestamp: string
  payload: Record<string, unknown>
} {
  const e = pedidosYaCourier.parseWebhookEvent(rawBody)
  return {
    event: "SHIPPING_STATUS",
    orderId: e.providerOrderId,
    status: e.providerStatus,
    mappedStatus: e.mappedStatus,
    timestamp: e.timestamp,
    payload: e.payload,
  }
}
