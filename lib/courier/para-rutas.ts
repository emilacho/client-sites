import "server-only"
/**
 * Puente entre las rutas de `/api/courier/*` y el proveedor de reparto.
 *
 * R108 · antes esto era `pedidosya-client.ts`, un andamio de R74 que
 * decía hablar con PedidosYa y en realidad devolvía datos simulados. El
 * proveedor real (`pedidosya-courier.ts`) estaba escrito desde julio y
 * las cuatro rutas seguían importando el andamio · el código bueno nunca
 * se ejecutaba. Se vació y quedó como capa de traducción; ahora además
 * **resuelve por el registro**, así que ya no está atado a PedidosYa: el
 * día que entre Rappi, las rutas no se tocan.
 *
 * Qué hace y por qué existe · las rutas hablan en "líneas del carrito y
 * total", el proveedor habla en "artículos y direcciones normalizadas".
 * Esa traducción vive UNA vez acá y no copiada en cada ruta.
 *
 * Lo que se fue con el andamio: el MODO SIMULADO. Si faltan credenciales
 * la ruta devuelve 503 con el nombre de la variable · falla a la vista,
 * nunca con un precio inventado.
 */
import { getCourierProvider } from "./index"
import type { CourierProvider, DispatchItem } from "./provider"
import type { DeliveryProvider } from "@/lib/schemas"

/** Proveedor por defecto · el registro decide, no este archivo. */
const POR_DEFECTO: DeliveryProvider = "PEDIDOSYA_COURIER"

/**
 * Devuelve el proveedor pedido, o explota con un mensaje que la ruta
 * convierte en 501 · "ese repartidor todavía no está implementado".
 */
function proveedor(id: DeliveryProvider = POR_DEFECTO): CourierProvider {
  const p = getCourierProvider(id)
  if (!p) throw new Error(`courier_provider_not_implemented:${id}`)
  return p
}

/* ─── Formas heredadas · las consumen las rutas de /api/courier ─── */

export interface QuoteParams {
  /** Cuál repartidor · si no se dice, el del registro por defecto. */
  providerId?: DeliveryProvider
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
  /** Cuál repartidor · si no se dice, el del registro por defecto. */
  providerId?: DeliveryProvider
  quoteToken: string
  dropoff: QuoteParams["dropoff"]
  customer: { name: string; phone: string; email?: string }
  lines: Array<{ name: string; qty: number; priceUsd: number }>
  notes?: string
  /** Nuestro código de pedido · viaja a PedidosYa para cruzarlo en su panel. */
  externalReference?: string
  /** R144 · lo que el motorizado cobra en la puerta · sin propina. */
  collectMoneyUsd?: number
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
  const r = await proveedor(params.providerId).getQuote({
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
  const r = await proveedor(params.providerId).dispatch({
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
    collectMoneyUsd: params.collectMoneyUsd,
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
  return proveedor().verifyWebhookSignature(rawBody, {
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
  const e = proveedor().parseWebhookEvent(rawBody)
  return {
    event: "SHIPPING_STATUS",
    orderId: e.providerOrderId,
    status: e.providerStatus,
    mappedStatus: e.mappedStatus,
    timestamp: e.timestamp,
    payload: e.payload,
  }
}
