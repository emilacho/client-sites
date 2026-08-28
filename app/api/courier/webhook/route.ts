import { NextResponse } from "next/server"
import {
  verifyWebhookSignature,
  parseWebhookEvent,
} from "@/lib/courier/para-rutas"
import { getSupabaseAdmin } from "@/lib/supabase"
import { buildStagePayload, sendPushForOrder } from "@/lib/push-server"
import { earnPerlas } from "@/lib/loyalty-server"
import { enviarVentaALoyverse } from "@/lib/loyverse"
import { haversineMeters, deriveDeliveryStatus } from "@/lib/geo"

export const runtime = "nodejs"
// PedidosYa retries non-2xx responses · keep this route fast.
export const maxDuration = 10

/**
 * Round 74 · PedidosYa Courier · webhook receiver.
 *
 *   POST /api/courier/webhook
 *     headers · x-pedidosya-signature (TODO confirm header name)
 *     body    · raw JSON, schema enforced loose · we update
 *               courier_orders.status by orderId.
 *
 * Signature verification uses HMAC-SHA256 with the secret stored
 * in PEDIDOSYA_COURIER_WEBHOOK_SECRET. In non-production env, an
 * unsigned request is allowed for local testing (gated inside the
 * verifyWebhookSignature helper).
 *
 * Idempotency · the same event can arrive multiple times. We upsert
 * the status by pedidosya_order_id, so duplicates are no-ops. The
 * last_webhook_at timestamp moves forward each event so the most
 * recent one wins.
 */
export async function POST(request: Request) {
  // Read the raw body first · we need it for HMAC verification,
  // then parse JSON ourselves.
  const rawBody = await request.text()
  // R107.2 · PedidosYa NO firma con HMAC ni manda `x-pedidosya-signature`:
  // manda la CLAVE ESTÁTICA que registramos, en `Authorization` y en
  // `x-api-key`. Esta ruta leía los dos encabezados equivocados, así que
  // la clave llegaba nula y se rechazaba TODO aviso — incluido el legítimo.
  // Medido: con la clave correcta devolvía 401 igual que sin clave.
  // Los dos nombres viejos quedan de respaldo, no cuestan nada.
  const signature =
    request.headers.get("authorization") ??
    request.headers.get("x-api-key") ??
    request.headers.get("x-pedidosya-signature") ??
    request.headers.get("x-signature")
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json(
      { error: "signature_invalid" },
      { status: 401 },
    )
  }

  // R107.3 · se lee con la forma REAL del aviso, no con la que supuso
  // R74. PedidosYa manda { topic, id, referenceId, generated,
  // transmitted, data: { status } } · la ruta validaba contra
  // { event, orderId, status, timestamp, payload } y por lo tanto
  // habría RECHAZADO con 400 todo aviso legítimo. El síntoma habría
  // sido "PedidosYa no manda avisos" con los avisos llegando.
  let event: ReturnType<typeof parseWebhookEvent>
  try {
    event = parseWebhookEvent(rawBody)
  } catch (err) {
    return NextResponse.json(
      {
        error: "validation_failed",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 400 },
    )
  }

  try {
    const supabase = getSupabaseAdmin()
    // R106 · las dos tablas viven en el esquema `naufrago` · ver la nota
    // en /api/courier/order/route.ts.
    await supabase
      .from("courier_orders")
      .update({
        status: event.status,
        last_webhook_at: new Date().toISOString(),
      })
      .eq("pedidosya_order_id", event.orderId)
    // Persist the full event log too (optional table for audit /
    // analytics · see migration TODO in /api/courier/order/route.ts).
    await supabase
      .from("courier_order_events")
      .insert({
        pedidosya_order_id: event.orderId,
        event: event.event,
        status: event.status,
        timestamp: event.timestamp ?? new Date().toISOString(),
        payload: event.payload ?? null,
      })
      .throwOnError()
      // Ignore "relation does not exist" pre-migration · don't fail
      // the webhook because the audit table isn't there yet.
      .then(undefined, (err: unknown) => {
        console.warn("[courier-webhook] event log skipped", err)
      })

    // R96.17 · push notification al cliente · query naufrago_orders
    // por delivery_provider_order_id → get order_code → send push a
    // todas las subscriptions activas para ese order. Graceful no-op
    // si VAPID env vars no set o no hay subs registradas.
    const { data: nfOrder } = await supabase
      .from("orders")
      .select(
        // R124 · se suman los datos de la venta (id, platos, envio, notas)
        // porque al ENTREGAR hay que mandarla a la contabilidad del local.
        // Va en UNA sola linea a proposito: el cliente deduce los tipos
        // leyendo este texto literal, y partirlo en trozos lo rompe.
        "id, order_code, status, customer_phone, total_usd, subtotal_usd, delivery_fee_usd, cart_lines, customer_notes, delivered_at, dropoff_lat, dropoff_lng",
      )
      .eq("delivery_provider_order_id", event.orderId)
      .maybeSingle()
    if (nfOrder?.order_code) {
      // Map courier status to naufrago order status + update naufrago_orders
      // so the tracker UI polling reflects it. Then build payload por status
      // y push send (fire-and-forget · no bloquea respuesta al webhook).
      // R107.3 · el pedido del cliente guarda el estado TRADUCIDO. Antes
      // guardaba el del proveedor tal cual ("NEAR_DROPOFF"), que NO es
      // uno de los 8 valores que acepta la tabla · la actualización
      // fallaba y el seguimiento se quedaba congelado en "recibido".
      // Medido: con un aviso NEAR_DROPOFF el pedido seguía en PENDING.
      // Si el estado no tiene traducción, no se toca el pedido.
      const orderUpdate: Record<string, unknown> = {}
      if (event.mappedStatus) orderUpdate.status = event.mappedStatus
      const p = event.payload as Record<string, unknown> | undefined

      // R96.19 · driver auto-fill · si payload trae rider info ·
      // upsert en naufrago_drivers + denormalize a rider_info JSONB
      // del order (tracker UI lee desde ahí · no necesita JOIN).
      const riderRaw = p?.rider as Record<string, unknown> | undefined
      const riderPhone =
        typeof riderRaw?.phone === "string"
          ? riderRaw.phone
          : typeof p?.rider_phone === "string"
            ? (p.rider_phone as string)
            : null
      if (riderPhone) {
        const driverRow = {
          client_slug: "naufrago",
          phone: riderPhone,
          name:
            typeof riderRaw?.name === "string"
              ? (riderRaw.name as string)
              : null,
          photo_url:
            typeof riderRaw?.photo_url === "string"
              ? (riderRaw.photo_url as string)
              : typeof riderRaw?.avatar === "string"
                ? (riderRaw.avatar as string)
                : null,
          rating:
            typeof riderRaw?.rating === "number"
              ? (riderRaw.rating as number)
              : null,
          plate:
            typeof riderRaw?.plate === "string"
              ? (riderRaw.plate as string)
              : null,
          vehicle_type:
            typeof riderRaw?.vehicle_type === "string"
              ? (riderRaw.vehicle_type as string)
              : null,
        }
        await supabase
          .from("drivers")
          .upsert(driverRow, { onConflict: "client_slug,phone" })

        // Re-read full driver row to get tenure
        const { data: driver } = await supabase
          .from("drivers")
          .select(
            "name, photo_url, rating, platform_tenure_months, plate, vehicle_type",
          )
          .eq("client_slug", "naufrago")
          .eq("phone", riderPhone)
          .maybeSingle()

        if (driver) {
          orderUpdate.rider_info = {
            phone: riderPhone,
            name: driver.name,
            photoUrl: driver.photo_url,
            rating: driver.rating,
            tenureMonths: driver.platform_tenure_months,
            plate: driver.plate,
            vehicleType: driver.vehicle_type,
          }
        }
      }
      // R96.18 · photo proof of delivery · si PedidosYa entrega event
      // DELIVERED con foto + GPS · persiste en naufrago_orders columns.
      // PedidosYa schema varies · probamos shapes comunes.
      // R107.4 · se compara contra el estado TRADUCIDO. El proveedor
      // nunca dice "DELIVERED" · dice "COMPLETED". Esta condición jamás
      // era cierta, así que la foto de entrega nunca se guardaba.
      if (event.mappedStatus === "DELIVERED" && p) {
        const photoUrl =
          (typeof p.delivery_photo_url === "string"
            ? p.delivery_photo_url
            : null) ??
          (typeof p.proof_photo_url === "string" ? p.proof_photo_url : null) ??
          (typeof p.photoUrl === "string" ? p.photoUrl : null)
        const lat =
          typeof p.delivery_lat === "number"
            ? p.delivery_lat
            : typeof p.lat === "number"
              ? p.lat
              : null
        const lng =
          typeof p.delivery_lng === "number"
            ? p.delivery_lng
            : typeof p.lng === "number"
              ? p.lng
              : null
        if (photoUrl) orderUpdate.delivery_photo_url = photoUrl
        if (lat !== null) orderUpdate.delivery_photo_lat = lat
        if (lng !== null) orderUpdate.delivery_photo_lng = lng
        orderUpdate.delivery_photo_at = new Date().toISOString()
      }
      await supabase
        .from("orders")
        .update(orderUpdate)
        .eq("order_code", nfOrder.order_code)
      // R107.4 · buildStagePayload decide según NUESTRO vocabulario
      // (PENDING · ACCEPTED · …). Recibía el del proveedor (COMPLETED ·
      // NEAR_DROPOFF), así que no coincidía con ningún caso y el cliente
      // no recibía NINGÚN aviso al teléfono en todo el recorrido.
      const payload = event.mappedStatus
        ? buildStagePayload(event.mappedStatus, nfOrder.order_code)
        : null
      if (payload) {
        void sendPushForOrder(nfOrder.order_code, payload).catch((err) => {
          console.warn("[courier-webhook] push send failed", err)
        })
      }
      // R96.21 · earn perlas al DELIVERED · idempotent vía ledger check.
      // R107.4 · idem · las perlas del cliente NUNCA se acreditaban
      // porque se esperaba "DELIVERED" y llegaba "COMPLETED".
      // R124 · AHORA SE ESPERA la respuesta. Antes iba con `void` -lanzado
      // y no esperado- y en este tipo de servidor la funcion se apaga en
      // cuanto responde, asi que el trabajo a medio hacer se muere con
      // ella. Es el mismo defecto que ya habia arreglado en R110 con el
      // aviso a la cocina, y aca estaba costando plata al cliente: medido
      // el 28-ago, 6 pedidos ENTREGADOS y UN SOLO movimiento de tesoro
      // registrado. El programa de fidelizacion estaba roto en silencio.
      if (event.mappedStatus === "DELIVERED" && nfOrder.customer_phone) {
        try {
          await earnPerlas({
            phone: nfOrder.customer_phone,
            totalUsd: nfOrder.total_usd ?? 0,
            orderCode: nfOrder.order_code,
          })
        } catch (err) {
          console.warn("[courier-webhook] no se pudo acreditar el tesoro", err)
        }
      }

      // R124 · la venta entra a la contabilidad del local (Loyverse).
      // Se manda al ENTREGAR y no al crear el pedido, porque se cobra
      // contra entrega: la venta recien es real cuando el cliente pago.
      // Si Loyverse falla, el pedido ya se entrego y el cliente ya pago ·
      // por eso esto nunca tumba nada, solo queda anotado.
      if (event.mappedStatus === "DELIVERED" && nfOrder.id) {
        const lineas = Array.isArray(nfOrder.cart_lines)
          ? (nfOrder.cart_lines as Array<{
              id?: string
              name?: string
              qty?: number
              priceUsd?: number
            }>)
          : []
        const venta = await enviarVentaALoyverse(String(nfOrder.id), {
          orderCode: nfOrder.order_code,
          lines: lineas.map((l) => ({
            id: String(l.id ?? ""),
            name: String(l.name ?? ""),
            qty: Number(l.qty ?? 1),
            priceUsd: Number(l.priceUsd ?? 0),
          })),
          deliveryFeeUsd: Number(nfOrder.delivery_fee_usd ?? 0),
          totalUsd: Number(nfOrder.total_usd ?? 0),
          notes: nfOrder.customer_notes ?? null,
          entregadoEn: nfOrder.delivered_at ?? null,
        })
        if (!("yaEstaba" in venta)) {
          await supabase
            .from("order_events")
            .insert({
              order_id: nfOrder.id,
              event_type: venta.ok ? "ACCOUNTING_SYNCED" : "ACCOUNTING_SYNC_FAILED",
              actor: "system",
              payload: venta.ok
                ? { receipt: venta.receiptNumber }
                : { motivo: venta.motivo },
            })
            .then(undefined, () => {})
        }
      }

      // R96.110 · WhatsApp status message · estilo Domino's Pizza Tracker.
      // Fire-and-forget · endpoint maneja Twilio not configured graceful.
      const origin =
        process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
      void fetch(`${origin}/api/notifications/order-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orderCode: nfOrder.order_code,
          newStatus: event.mappedStatus ?? event.status,
        }),
        keepalive: true,
      }).catch(() => {})

      // R96.155 · Geofencing rider→dropoff · si el rider tiene lat/lng
      // en el payload y tenemos coords del dropoff · derivar el sub-status
      // (OUT_FOR_DELIVERY · NEARING_DESTINATION · AT_DESTINATION) según
      // la distancia. Cuando cambia el sub-status · dispatch WhatsApp
      // template (📍 cerca · 🚪 llegó). Idempotente vía event log.
      const riderLat =
        typeof p?.rider_lat === "number"
          ? (p.rider_lat as number)
          : typeof riderRaw?.lat === "number"
            ? (riderRaw.lat as number)
            : null
      const riderLng =
        typeof p?.rider_lng === "number"
          ? (p.rider_lng as number)
          : typeof riderRaw?.lng === "number"
            ? (riderRaw.lng as number)
            : null
      if (
        // R107.4 · "OUT_FOR_DELIVERY" no es un estado de PedidosYa NI
        // nuestro · la rama estaba muerta. El equivalente real es el
        // motorizado en camino con el pedido encima.
        event.mappedStatus === "IN_TRANSIT" &&
        riderLat !== null &&
        riderLng !== null &&
        nfOrder.dropoff_lat !== null &&
        nfOrder.dropoff_lng !== null
      ) {
        const distance = haversineMeters(
          riderLat,
          riderLng,
          Number(nfOrder.dropoff_lat),
          Number(nfOrder.dropoff_lng),
        )
        // Pre-fetch del current sub-status (si ya pasamos por NEARING)
        const { data: currentRow } = await supabase
          .from("orders")
          .select("delivery_substatus")
          .eq("order_code", nfOrder.order_code)
          .maybeSingle()
        const currentSubStatus =
          (currentRow?.delivery_substatus as
            | "OUT_FOR_DELIVERY"
            | "NEARING_DESTINATION"
            | "AT_DESTINATION"
            | null) ?? "OUT_FOR_DELIVERY"
        const derivedSubStatus = deriveDeliveryStatus(distance, currentSubStatus)

        if (derivedSubStatus !== currentSubStatus) {
          // State transition · persist + WhatsApp dispatch
          await supabase
            .from("orders")
            .update({ delivery_substatus: derivedSubStatus })
            .eq("order_code", nfOrder.order_code)
          void fetch(`${origin}/api/notifications/order-status`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              orderCode: nfOrder.order_code,
              newStatus: derivedSubStatus,
            }),
            keepalive: true,
          }).catch(() => {})
        }
      }
    }
  } catch (err) {
    console.warn("[courier-webhook] supabase update failed", err)
    // Even if persistence fails, return 200 so PedidosYa doesn't
    // hammer retries. We log and rely on subsequent events to
    // recover the state.
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/courier/webhook",
    method: "POST",
    runtime: "nodejs",
    description:
      "PedidosYa Courier · order status webhook · HMAC-verified.",
  })
}
