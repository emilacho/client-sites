import "server-only"
/**
 * Mandar cada venta de la web a Loyverse · R124.
 *
 * EL PROBLEMA QUE RESUELVE
 * Los pedidos de naufrago.ec no existen para el punto de venta del local.
 * Si se venden 20 encebollados por la pagina, Loyverse cree que se
 * vendieron CERO: el reporte del dia miente y el inventario tambien. Hoy
 * hay una contabilidad paralela sin que nadie la haya decidido.
 *
 * QUE HACE
 * Cuando un pedido se ENTREGA -que es cuando la venta es real, porque se
 * cobra contra entrega- le manda a Loyverse un recibo de venta con los
 * platos, el envio y el total.
 *
 * QUE NO HACE
 * NO manda pedidos a la cocina. La API de Loyverse no puede crear un
 * pedido pendiente: su unico endpoint de escritura de ventas es
 * "Create a sales receipt", una venta YA CERRADA. Y su pantalla de cocina
 * solo muestra lo que sale de su propio punto de venta. Avisar a la cocina
 * es otro problema y se resuelve por otro lado.
 *
 * REGLA DE ORO · esto NUNCA puede tumbar un pedido ni una entrega. Si
 * Loyverse esta caido, el pedido ya se entrego y el cliente ya cobro. Por
 * eso todo devuelve un resultado en vez de tirar excepcion.
 */

import { getSupabaseAdmin } from "@/lib/supabase"

const BASE = "https://api.loyverse.com/v1.0"

export interface LineaDeVenta {
  id: string
  name: string
  qty: number
  priceUsd: number
}

export interface VentaParaLoyverse {
  orderCode: string
  lines: LineaDeVenta[]
  deliveryFeeUsd: number
  totalUsd: number
  notes?: string | null
  entregadoEn?: string | null
}

export type ResultadoVenta =
  | { ok: true; receiptNumber: string }
  | { ok: true; yaEstaba: true }
  | { ok: false; motivo: string }

/** La clave reservada del envio en la tabla de equivalencias. */
export const CLAVE_ENVIO = "__envio__"

function credenciales() {
  const token = process.env.LOYVERSE_TOKEN
  const storeId = process.env.LOYVERSE_STORE_ID
  const paymentTypeId = process.env.LOYVERSE_PAYMENT_TYPE_ID
  if (!token || !storeId || !paymentTypeId) return null
  return { token, storeId, paymentTypeId }
}

/** Lee la tabla de equivalencias · nuestro plato -> producto de Loyverse. */
async function equivalencias(): Promise<Map<string, string>> {
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("loyverse_item_map")
    .select("menu_item_id, variant_id")
  const m = new Map<string, string>()
  for (const fila of data ?? []) {
    const k = (fila as { menu_item_id?: string }).menu_item_id
    const v = (fila as { variant_id?: string }).variant_id
    if (k && v) m.set(k, v)
  }
  return m
}

/**
 * ¿Esta venta ya se mando? · el registro de eventos es la fuente de verdad.
 *
 * Sin esto, un reintento del aviso del repartidor -PedidosYa reintenta a
 * los 10 minutos- crearia la MISMA venta dos veces en la contabilidad.
 * Duplicar ingresos es peor que no registrarlos: el primero se nota, el
 * segundo no.
 */
async function yaSeMando(orderId: string): Promise<boolean> {
  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("order_events")
    .select("id")
    .eq("order_id", orderId)
    .eq("event_type", "ACCOUNTING_SYNCED")
    .limit(1)
  return Boolean(data && data.length > 0)
}

/**
 * Manda la venta. NUNCA tira excepcion.
 *
 * `orderId` es el id interno del pedido, para el control de duplicados.
 */
export async function enviarVentaALoyverse(
  orderId: string,
  venta: VentaParaLoyverse,
): Promise<ResultadoVenta> {
  const cred = credenciales()
  if (!cred) return { ok: false, motivo: "loyverse_sin_configurar" }

  try {
    if (await yaSeMando(orderId)) return { ok: true, yaEstaba: true }

    const mapa = await equivalencias()
    if (mapa.size === 0) return { ok: false, motivo: "sin_equivalencias_cargadas" }

    const lineas: Array<Record<string, unknown>> = []
    const sinEquivalencia: string[] = []

    for (const l of venta.lines) {
      const variantId = mapa.get(l.id)
      if (!variantId) {
        sinEquivalencia.push(l.id)
        continue
      }
      lineas.push({
        variant_id: variantId,
        quantity: l.qty,
        price: l.priceUsd,
      })
    }

    // Un plato sin equivalencia haria que el recibo NO cuadre con lo que
    // el cliente pago. Preferimos no mandar nada y dejarlo anotado, antes
    // que meter una venta incompleta en la contabilidad: una venta que
    // falta se ve, una venta con el monto mal no.
    if (sinEquivalencia.length > 0) {
      return { ok: false, motivo: `platos_sin_equivalencia:${sinEquivalencia.join(",")}` }
    }

    // El envio ocupa su propia linea · Loyverse no tiene un campo aparte
    // para el costo de reparto.
    if (venta.deliveryFeeUsd > 0) {
      const envioId = mapa.get(CLAVE_ENVIO)
      if (!envioId) return { ok: false, motivo: "sin_equivalencia_para_envio" }
      lineas.push({ variant_id: envioId, quantity: 1, price: venta.deliveryFeeUsd })
    }

    if (lineas.length === 0) return { ok: false, motivo: "venta_sin_lineas" }

    const cuerpo = {
      store_id: cred.storeId,
      order: venta.orderCode,
      source: "naufrago.ec",
      receipt_date: venta.entregadoEn ?? new Date().toISOString(),
      note: venta.notes ? venta.notes.slice(0, 500) : undefined,
      line_items: lineas,
      payments: [
        {
          payment_type_id: cred.paymentTypeId,
          money_amount: venta.totalUsd,
        },
      ],
    }

    const res = await fetch(`${BASE}/receipts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cred.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo),
    })

    if (!res.ok) {
      const detalle = await res.text().catch(() => "")
      return { ok: false, motivo: `loyverse_${res.status}:${detalle.slice(0, 250)}` }
    }

    const data = (await res.json()) as { receipt_number?: string }
    return { ok: true, receiptNumber: data.receipt_number ?? "" }
  } catch (err) {
    return { ok: false, motivo: err instanceof Error ? err.message : String(err) }
  }
}
