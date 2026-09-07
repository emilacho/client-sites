import "server-only"
/**
 * R164 · manda a la calle un pedido que YA se pagó con tarjeta.
 *
 * Con efectivo el pedido sale primero y el motorizado cobra en la
 * puerta. Con tarjeta el orden se invierte: primero entra la plata,
 * después sale la comida. Esta función es la segunda mitad · la llama
 * la pantalla de confirmación de PayPhone cuando el cobro se aprueba.
 *
 * TRES COSAS QUE ESTA FUNCIÓN TIENE QUE AGUANTAR
 *
 * 1 · Que la llamen dos veces. El cliente puede recargar la pantalla de
 *     vuelta de PayPhone. Si el pedido ya tiene número de envío, no se
 *     despacha de nuevo · se devuelve el que ya existe.
 *
 * 2 · Que la cotización se haya vencido. Entre que el cliente abrió el
 *     formulario de pago y terminó de pagar pueden pasar varios
 *     minutos, y la cotización de PedidosYa dura poco. Si el número
 *     guardado ya no sirve, se pide uno nuevo y se despacha con ese.
 *
 * 3 · Que el despacho falle igual. Acá la plata YA ENTRÓ · no se puede
 *     devolver un "error" y olvidarse. El pedido queda marcado para que
 *     la cocina lo vea y lo resuelva a mano, y la función dice que no
 *     pudo, sin romper la pantalla del cliente.
 */
import { createOrder, getDeliveryQuote } from "@/lib/courier/para-rutas"
import { getSupabaseAdmin } from "@/lib/supabase"
import { origenPropio } from "@/lib/origen"
import { cliente } from "@/cliente.config"

export interface ResultadoDespacho {
  ok: boolean
  /** Ya estaba despachado de antes · no se hizo nada nuevo. */
  yaEstaba?: boolean
  trackingUrl?: string | null
  motivo?: string
}

interface LineaGuardada {
  name?: string
  qty?: number
  priceUsd?: number
}

export async function despacharPedidoPagado(
  orderCode: string,
): Promise<ResultadoDespacho> {
  const supabase = getSupabaseAdmin()

  const { data } = await supabase
    .from("orders")
    .select(
      "id, order_code, status, payment_status, delivery_provider_order_id, delivery_provider_tracking_url, delivery_quote_token, customer_name, customer_phone, customer_email, dropoff_address, dropoff_detail, dropoff_lat, dropoff_lng, dropoff_country_code, cart_lines, customer_notes, subtotal_usd",
    )
    .eq("client_slug", cliente.slug)
    .eq("order_code", orderCode)
    .maybeSingle()

  const pedido = data as {
    id: string
    order_code: string
    status: string
    payment_status: string
    delivery_provider_order_id: string | null
    delivery_provider_tracking_url: string | null
    delivery_quote_token: string | null
    customer_name: string
    customer_phone: string
    customer_email: string | null
    dropoff_address: string
    dropoff_detail: string | null
    dropoff_lat: number | null
    dropoff_lng: number | null
    dropoff_country_code: string | null
    cart_lines: LineaGuardada[] | null
    customer_notes: string | null
    subtotal_usd: number | null
  } | null

  if (!pedido) return { ok: false, motivo: "pedido_no_encontrado" }

  // (1) Ya salió · no se despacha dos veces.
  if (pedido.delivery_provider_order_id) {
    return {
      ok: true,
      yaEstaba: true,
      trackingUrl: pedido.delivery_provider_tracking_url,
    }
  }
  // No se despacha nada que no esté cobrado. Esta es la única puerta.
  if (pedido.payment_status !== "CAPTURED") {
    return { ok: false, motivo: "pedido_no_pagado" }
  }
  if (pedido.status === "CANCELLED") {
    return { ok: false, motivo: "pedido_cancelado" }
  }

  const dropoff = {
    street: pedido.dropoff_address,
    detail: pedido.dropoff_detail ?? undefined,
    countryCode: pedido.dropoff_country_code ?? "EC",
    latitude: pedido.dropoff_lat ?? undefined,
    longitude: pedido.dropoff_lng ?? undefined,
  }
  const lines = (pedido.cart_lines ?? []).map((l) => ({
    name: String(l?.name ?? "Item"),
    qty: Number(l?.qty ?? 1),
    priceUsd: Number(l?.priceUsd ?? 0),
  }))

  const despachar = (quoteToken: string) =>
    createOrder({
      quoteToken,
      dropoff,
      customer: {
        name: pedido.customer_name,
        phone: pedido.customer_phone,
        email: pedido.customer_email ?? undefined,
      },
      lines,
      notes: pedido.customer_notes ?? undefined,
      externalReference: pedido.order_code,
      // Ya está pagado · el motorizado NO cobra nada en la puerta.
      collectMoneyUsd: 0,
    })

  let envio: Awaited<ReturnType<typeof createOrder>> | null = null
  let ultimoError = ""

  if (pedido.delivery_quote_token) {
    try {
      envio = await despachar(pedido.delivery_quote_token)
    } catch (err) {
      ultimoError = err instanceof Error ? err.message : String(err)
    }
  }

  // (2) La cotización se venció mientras el cliente pagaba · una nueva.
  if (!envio) {
    try {
      const nueva = await getDeliveryQuote({
        dropoff,
        cartTotalUsd: Number(pedido.subtotal_usd ?? 0),
        itemCount: lines.reduce((n, l) => n + l.qty, 0),
      })
      envio = await despachar(nueva.quoteToken)
    } catch (err) {
      ultimoError = err instanceof Error ? err.message : String(err)
    }
  }

  // (3) No salió · y la plata ya entró. Queda a la vista de la cocina.
  if (!envio) {
    await supabase
      .from("orders")
      .update({ status: "NEEDS_ATTENTION" })
      .eq("id", pedido.id)
    await supabase
      .from("order_events")
      .insert({
        order_id: pedido.id,
        event_type: "DISPATCH_FAILED_AFTER_PAYMENT",
        actor: "system",
        payload: { motivo: ultimoError },
      })
      .then(
        () => {},
        () => {},
      )
    console.error(
      `[despachar-pagado] ${orderCode} COBRADO PERO SIN DESPACHAR · ${ultimoError}`,
    )
    return { ok: false, motivo: ultimoError || "dispatch_failed" }
  }

  await supabase
    .from("orders")
    .update({
      status: "PENDING",
      delivery_provider_order_id: envio.orderId,
      delivery_provider_tracking_url: envio.trackingUrl ?? null,
      delivery_fee_usd: envio.priceUsd ?? undefined,
      delivery_eta_minutes: envio.etaMinutes ?? null,
      raw_dispatch_response: envio.raw as object,
    })
    .eq("id", pedido.id)

  await supabase
    .from("order_events")
    .insert({
      order_id: pedido.id,
      event_type: "ORDER_CREATED",
      actor: "system",
      payload: { despues_del_pago: true, envio_id: envio.orderId },
    })
    .then(
      () => {},
      () => {},
    )

  // Recién ahora el cliente recibe su aviso · el pedido existe de verdad.
  await fetch(`${origenPropio()}/api/notifications/order-status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ orderCode: pedido.order_code, newStatus: "ACCEPTED" }),
  }).catch(() => {})

  return { ok: true, trackingUrl: envio.trackingUrl ?? null }
}
