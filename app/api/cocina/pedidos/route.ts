import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { cocinaAutorizada } from "@/lib/cocina-llave"
import { motorizadoParaCocina } from "@/lib/cocina-motorizado"
import { refrescarPosicion, type RiderGuardado } from "@/lib/tracker/posicion-en-vivo"
import type { NaufragoOrderStatus } from "@/lib/schemas"

/**
 * GET /api/cocina/pedidos · R132
 *
 * Lo que la cocina necesita ver de los pedidos de la web, y nada más.
 *
 * Devuelve tambien si la venta YA ENTRÓ a la contabilidad del local
 * (Loyverse). Esa columna es el punto de todo esto: la pantalla es
 * nuestra, pero la plata se cuenta en UN solo lado. Si un pedido queda
 * fuera, se ve acá y no dentro de tres días cuadrando caja.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const CLIENT_SLUG = "naufrago"

/**
 * Los que siguen EN LA COCINA · los únicos que ocupan el tablero.
 *
 * READY queda AFUERA a propósito: en el KDS de Loyverse, cuando se toca
 * la cabecera el ticket desaparece del tablero. Acá igual · pasa a la
 * lista de terminados, que es donde se cobra. Si READY siguiera acá, el
 * ticket se quedaría pegado en pantalla después de darlo por listo, que
 * es justo lo que pasó la primera vez que lo probé.
 */
// R164 · NEEDS_ATTENTION entra a la lista de vivos a propósito: es un
// pedido COBRADO cuyo motorizado no se pudo pedir. Si no está entre los
// vivos, la cocina no lo ve, el cliente pagó y nadie cocina nada.
const VIVOS = ["PENDING", "ACCEPTED", "PREPARING", "NEEDS_ATTENTION"]

export async function GET(req: NextRequest) {
  if (!(await cocinaAutorizada(req.headers.get("x-cocina-llave")))) {
    return Response.json({ ok: false, error: "no_autorizado" }, { status: 401 })
  }

  const supa = getSupabaseAdmin()
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supa
    .from("orders")
    .select(
      "id, order_code, status, created_at, accepted_at, ready_at, delivered_at, customer_name, customer_phone, dropoff_address, dropoff_detail, cart_lines, customer_notes, subtotal_usd, discount_usd, delivery_fee_usd, total_usd, tip_usd, payment_method, payment_status, delivery_provider_order_id, dropoff_lat, dropoff_lng, rider_info",
    )
    .eq("client_slug", CLIENT_SLUG)
    // R164 · los pedidos que quedaron esperando un pago que nunca entró
    // NO son asunto de la cocina · son carritos abandonados. Si se
    // mostraran, la pantalla se llenaría de pedidos que nadie va a
    // cocinar y el sonido de "pedido nuevo" perdería sentido.
    .neq("status", "PENDING_PAYMENT")
    .gte("created_at", desde)
    .order("created_at", { ascending: true })
    .limit(60)

  if (error) {
    return Response.json({ ok: false, error: error.message }, { status: 500 })
  }

  const pedidos = data ?? []
  const ids = pedidos.map((p) => p.id)

  // ¿Cuáles ya llegaron a la contabilidad? · una sola consulta para todos.
  const contabilidad = new Map<string, "ok" | "falló">()
  if (ids.length > 0) {
    const { data: eventos } = await supa
      .from("order_events")
      .select("order_id, event_type")
      .in("order_id", ids)
      .in("event_type", ["ACCOUNTING_SYNCED", "ACCOUNTING_SYNC_FAILED"])
    for (const e of eventos ?? []) {
      const fila = e as { order_id: string; event_type: string }
      // Un ÉXITO posterior pisa a un fallo anterior · el reintento cuenta.
      if (fila.event_type === "ACCOUNTING_SYNCED") contabilidad.set(fila.order_id, "ok")
      else if (!contabilidad.has(fila.order_id)) contabilidad.set(fila.order_id, "falló")
    }
  }

  // R176 · dónde va el motorizado de cada pedido que ya lo pidió. Lo último que
  // dijo PedidosYa (una sola consulta) + su posición en vivo (la misma que usa el
  // seguimiento del cliente, con su freno de 8 s por pedido).
  const conEnvio = pedidos.filter(
    (p) => p.delivery_provider_order_id && !["DELIVERED", "CANCELLED", "PENDING_PAYMENT"].includes(String(p.status)),
  )
  const ultimoAviso = new Map<string, { status: string; retiro: unknown }>()
  if (conEnvio.length > 0) {
    const { data: avisos } = await supa
      .from("courier_order_events")
      .select("pedidosya_order_id, status, payload, received_at")
      .in("pedidosya_order_id", conEnvio.map((p) => p.delivery_provider_order_id as string))
      .order("received_at", { ascending: false })
      .limit(200)
    for (const a of (avisos ?? []) as Array<{ pedidosya_order_id: string; status: string; payload: { data?: { estimatedPickUpTime?: unknown } } | null }>) {
      if (!ultimoAviso.has(a.pedidosya_order_id)) ultimoAviso.set(a.pedidosya_order_id, { status: a.status, retiro: a.payload?.data?.estimatedPickUpTime })
    }
  }
  const motorizados = new Map<string, ReturnType<typeof motorizadoParaCocina>>()
  await Promise.all(
    conEnvio.map(async (p) => {
      const rider = await refrescarPosicion({
        id: p.id,
        status: p.status as NaufragoOrderStatus,
        delivery_provider_order_id: p.delivery_provider_order_id,
        dropoff_lat: (p as { dropoff_lat?: number | null }).dropoff_lat ?? null,
        dropoff_lng: (p as { dropoff_lng?: number | null }).dropoff_lng ?? null,
        rider_info: ((p as { rider_info?: RiderGuardado | null }).rider_info ?? null) as RiderGuardado | null,
      })
      const aviso = ultimoAviso.get(p.delivery_provider_order_id as string)
      motorizados.set(p.id, motorizadoParaCocina(aviso?.status, aviso?.retiro, rider))
    }),
  )

  return Response.json({
    ok: true,
    ahora: new Date().toISOString(),
    pedidos: pedidos.map((p) => ({
      ...p,
      /** R176 · dónde va el motorizado · null si aún no se pidió. */
      motorizado: motorizados.get(p.id) ?? null,
      vivo: VIVOS.includes(String(p.status)),
      /** R164 · cobrado y sin motorizado · hay que pedirlo a mano. */
      atencion: String(p.status) === "NEEDS_ATTENTION",
      contabilidad: contabilidad.get(p.id) ?? null,
    })),
  })
}
