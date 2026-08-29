import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { cocinaAutorizada } from "@/lib/cocina-llave"
import { enviarVentaALoyverse } from "@/lib/loyverse"

/**
 * POST /api/cocina/avanzar · R132
 *
 * La cocina mueve el pedido: aceptado → en preparación → listo →
 * entregado y cobrado.
 *
 * EL PASO QUE IMPORTA ES EL ÚLTIMO. "Entregado y cobrado" no es sólo un
 * cambio de estado: manda la venta a Loyverse. Esa es la condición que
 * puso Emilio y es la que evita tener dos sistemas · la pantalla es
 * nuestra, la contabilidad sigue siendo UNA y vive en el punto de venta.
 *
 * El envío a Loyverse ya trae su propio control de duplicados (mira el
 * historial del pedido), así que si el aviso del repartidor también lo
 * manda, la venta entra UNA sola vez. Los dos caminos pueden convivir.
 *
 * Y si Loyverse falla, el pedido igual queda entregado: la comida ya
 * salió y el cliente ya pagó. El fallo queda anotado y la pantalla lo
 * muestra en rojo para reintentar.
 */

export const runtime = "nodejs"

const PASOS = {
  aceptar: {
    estado: "ACCEPTED",
    evento: "KITCHEN_ACCEPTED",
    sello: "accepted_at",
  },
  preparar: {
    estado: "PREPARING",
    evento: "PREPARING_STARTED",
    sello: "preparing_at",
  },
  listo: {
    estado: "READY",
    evento: "READY_FOR_PICKUP",
    sello: "ready_at",
  },
  entregado: {
    estado: "DELIVERED",
    evento: "DELIVERED",
    sello: "delivered_at",
  },
  // R136 · cancelar. NO manda nada a Loyverse: un pedido cancelado no es
  // una venta, y meterlo para después anularlo ensucia la contabilidad
  // con dos movimientos que nunca existieron.
  cancelar: {
    estado: "CANCELLED",
    evento: "CANCELLED",
    sello: "cancelled_at",
  },
} as const

type Paso = keyof typeof PASOS

export async function POST(req: NextRequest) {
  if (!(await cocinaAutorizada(req.headers.get("x-cocina-llave")))) {
    return Response.json({ ok: false, error: "no_autorizado" }, { status: 401 })
  }

  let cuerpo: { orderId?: unknown; paso?: unknown }
  try {
    cuerpo = await req.json()
  } catch {
    return Response.json({ ok: false, error: "cuerpo_invalido" }, { status: 400 })
  }

  const orderId = typeof cuerpo.orderId === "string" ? cuerpo.orderId : null
  const paso = String(cuerpo.paso ?? "") as Paso
  if (!orderId || !(paso in PASOS)) {
    return Response.json({ ok: false, error: "faltan_datos" }, { status: 400 })
  }

  const supa = getSupabaseAdmin()
  const { data: pedido, error: errorLectura } = await supa
    .from("orders")
    .select(
      "id, order_code, status, cart_lines, delivery_fee_usd, total_usd, customer_notes, delivered_at",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (errorLectura || !pedido) {
    return Response.json({ ok: false, error: "pedido_no_encontrado" }, { status: 404 })
  }
  if (pedido.status === "CANCELLED") {
    return Response.json({ ok: false, error: "pedido_cancelado" }, { status: 409 })
  }

  const destino = PASOS[paso]
  const ahora = new Date().toISOString()

  const cambios: Record<string, unknown> = {
    status: destino.estado,
    [destino.sello]: ahora,
  }
  if (paso === "cancelar") {
    cambios.cancellation_reason = "Cancelado desde la pantalla de cocina"
  }

  const { error: errorEscritura } = await supa
    .from("orders")
    .update(cambios)
    .eq("id", orderId)

  if (errorEscritura) {
    return Response.json({ ok: false, error: errorEscritura.message }, { status: 500 })
  }

  await supa
    .from("order_events")
    .insert({
      order_id: orderId,
      event_type: destino.evento,
      actor: "staff",
      payload: { desde: pedido.status, pantalla: "cocina" },
    })
    .then(undefined, () => {})

  // ── El último paso manda la venta a la contabilidad del local ──────
  let contabilidad: string | null = null
  if (paso === "entregado") {
    const lineas = Array.isArray(pedido.cart_lines)
      ? (pedido.cart_lines as Array<{
          id?: string
          name?: string
          qty?: number
          priceUsd?: number
        }>)
      : []
    const venta = await enviarVentaALoyverse(String(pedido.id), {
      orderCode: pedido.order_code,
      lines: lineas.map((l) => ({
        id: String(l.id ?? ""),
        name: String(l.name ?? ""),
        qty: Number(l.qty ?? 1),
        priceUsd: Number(l.priceUsd ?? 0),
      })),
      deliveryFeeUsd: Number(pedido.delivery_fee_usd ?? 0),
      totalUsd: Number(pedido.total_usd ?? 0),
      notes: pedido.customer_notes ?? null,
      entregadoEn: ahora,
    })

    if ("yaEstaba" in venta) {
      contabilidad = "ok"
    } else {
      contabilidad = venta.ok ? "ok" : "falló"
      await supa
        .from("order_events")
        .insert({
          order_id: orderId,
          event_type: venta.ok ? "ACCOUNTING_SYNCED" : "ACCOUNTING_SYNC_FAILED",
          actor: "staff",
          payload: venta.ok ? { receipt: venta.receiptNumber } : { motivo: venta.motivo },
        })
        .then(undefined, () => {})
    }
  }

  return Response.json({ ok: true, estado: destino.estado, contabilidad })
}
