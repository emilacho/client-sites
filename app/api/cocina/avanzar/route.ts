import type { NextRequest } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { cocinaAutorizada } from "@/lib/cocina-llave"
import { enviarVentaALoyverse } from "@/lib/loyverse"
import { cancelarEnvio } from "@/lib/courier/para-rutas"
import { devolverPerlasDelPedido } from "@/lib/loyalty-server"

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
      "id, order_code, status, cart_lines, delivery_fee_usd, total_usd, customer_notes, delivered_at, delivery_provider_order_id",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (errorLectura || !pedido) {
    return Response.json({ ok: false, error: "pedido_no_encontrado" }, { status: 404 })
  }
  if (pedido.status === "CANCELLED") {
    return Response.json({ ok: false, error: "pedido_cancelado" }, { status: 409 })
  }

  // ── La cocina anuncia "listo"; la ENTREGA la confirma el motorizado ──
  //
  // Emilio, 28-oct: la cocina avisa que el pedido está listo para
  // entregarlo al motorizado · "entregado" lo dice el motorizado a
  // través de PedidosYa (aviso COMPLETED de /api/courier/webhook).
  // Antes un toque en "Cobrado" (la lista de terminados) marcaba el
  // pedido como entregado 14 s después de "listo", sin que saliera
  // ninguna moto, y le avisaba al cliente que su comida había llegado.
  //
  // `entregado` queda sólo para REINTENTAR la contabilidad de un pedido
  // que el motorizado YA entregó: no cambia el estado ni la hora.
  const soloContabilidad = paso === "entregado"
  if (soloContabilidad && pedido.status !== "DELIVERED") {
    return Response.json(
      {
        ok: false,
        error: "lo_marca_el_motorizado",
        message: "La entrega la confirma el motorizado por PedidosYa, no la cocina.",
      },
      { status: 409 },
    )
  }
  // Los pasos de cocina sólo van hacia adelante: no se vuelve a
  // "preparando" un pedido que ya salió ni se "acepta" uno ya listo.
  const RANGO: Record<string, number> = {
    PENDING: 0,
    NEEDS_ATTENTION: 0,
    ACCEPTED: 1,
    PREPARING: 2,
    READY: 3,
    RIDER_PICKED_UP: 4,
    IN_TRANSIT: 5,
    DELIVERED: 6,
  }
  const RANGO_DEL_PASO: Record<string, number> = { aceptar: 1, preparar: 2, listo: 3 }
  if (
    paso in RANGO_DEL_PASO &&
    (RANGO[String(pedido.status)] ?? 0) >= RANGO_DEL_PASO[paso]
  ) {
    return Response.json(
      { ok: false, error: "paso_ya_dado", estadoActual: pedido.status },
      { status: 409 },
    )
  }
  if (paso === "cancelar" && pedido.status === "DELIVERED") {
    return Response.json({ ok: false, error: "pedido_entregado" }, { status: 409 })
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

  if (!soloContabilidad) {
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
  }

  // ── R159 · cancelar de verdad, no sólo en nuestra pantalla ────────
  //
  // Hasta hoy cancelar marcaba el pedido acá y NADA MÁS. El motorizado
  // seguía yendo igual a la puerta del cliente · y desde R144 con orden
  // de cobrar. O sea: el local cancelaba, al cliente se le decía que su
  // pedido estaba anulado, y aparecía alguien a cobrarle comida que
  // nunca se hizo.
  //
  // El proveedor SÍ sabe cancelar -está implementado desde siempre- y no
  // lo llamaba nadie. Mismo caso que las perlas.
  const avisos: string[] = []
  if (paso === "cancelar") {
    if (pedido.delivery_provider_order_id) {
      try {
        // Su documentación pide comunicar siempre el motivo · se manda.
        await cancelarEnvio(
          pedido.delivery_provider_order_id,
          "Cancelado por el local desde la pantalla de cocina",
        )
      } catch (err) {
        // R159.1 · CORREGIDO tras leer las reglas de PedidosYa.
        //
        // Su documentación es explícita: sólo se puede cancelar por
        // sistema un envío en CONFIRMED, o sea creado y todavía sin
        // repartidor asignado. En IN_PROGRESS, NEAR_PICKUP, PICKED_UP o
        // NEAR_DROPOFF hay que PEDIRLE LA CANCELACIÓN A ELLOS · no
        // llamar al motorizado, que fue lo que puse primero y está mal.
        //
        // El campo `onlineSupportUrl` que devolvían para eso figura como
        // DESCONTINUADO en su propia especificación. La vía vigente es
        // entrar a envios.pedidosya.com, sección "Mis envíos", y usar
        // "Solicitar ayuda" sobre ese envío.
        const message = err instanceof Error ? err.message : String(err)
        const yaEnCurso = /cancel_(404|409)/.test(message)
        avisos.push(
          yaEnCurso
            ? `El repartidor ya tomó este envío · PedidosYa no deja cancelarlo por sistema. Entra a envios.pedidosya.com → Mis envíos → Solicitar ayuda, y pide la cancelación del envío ${pedido.delivery_provider_order_id}.`
            : `No se pudo cancelar el envío en PedidosYa · revísalo en envios.pedidosya.com → Mis envíos (envío ${pedido.delivery_provider_order_id}).`,
        )
        console.warn("[cocina] no se pudo cancelar el envío", err)
      }
    }

    // Y si había gastado su tesoro en el premio, se le devuelve. No
    // recibió nada · quedarse con sus perlas sería quedarse con lo que
    // juntó en $60 de compras.
    try {
      const dev = await devolverPerlasDelPedido(pedido.order_code)
      if (dev) avisos.push(`Se le devolvieron ${dev.devueltas} perlas`)
    } catch (err) {
      console.warn("[cocina] no se pudieron devolver las perlas", err)
    }
  }

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
      entregadoEn: pedido.delivered_at ?? ahora,
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

  // R159 · los avisos van de vuelta a la pantalla. Si el motorizado ya
  // salió y hay que llamarlo, la cocina TIENE que enterarse en el momento.
  return Response.json({
    ok: true,
    estado: destino.estado,
    contabilidad,
    ...(avisos.length ? { avisos } : {}),
  })
}
