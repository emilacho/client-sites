import { NextResponse } from "next/server"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { origenPropio } from "@/lib/origen"
import { courierOrderRequestSchema } from "@/lib/schemas"
import { createOrder, getDeliveryQuote } from "@/lib/courier/para-rutas"
import { computeDiscount } from "@/lib/checkout/pricing"
import { revisarPrecios } from "@/lib/checkout/precio-real"
import { tieneDerechoAlCupon } from "@/lib/checkout/cupon"
import { getSupabaseAdmin } from "@/lib/supabase"
import { telefonoCanonico } from "@/lib/telefono"
import { cliente } from "@/cliente.config"

export const runtime = "nodejs"

/**
 * Round 74 · PedidosYa Courier · create order endpoint.
 *
 *   POST /api/courier/order
 *     body  · { quoteToken, dropoff, customer, lines, notes? }
 *     resp  · { ok: true, orderId, trackingUrl?, status }
 *
 * Two-step responsibility:
 *   1. Promote the saved quote → real PedidosYa order
 *   2. Persist the order to `courier_orders` (Supabase) so the
 *      webhook handler can match incoming status events.
 *
 * The Supabase table is referenced but NOT migrated in this round
 * · the schema lives at TODO(R74-migration) below for the
 * follow-up commit:
 *
 *   create table courier_orders (
 *     id              uuid primary key default gen_random_uuid(),
 *     client_slug     text not null,
 *     pedidosya_order_id text unique not null,
 *     quote_token     text not null,
 *     status          text not null default 'CREATED',
 *     customer_name   text,
 *     customer_phone  text,
 *     customer_email  text,
 *     dropoff_address text,
 *     cart_lines      jsonb,
 *     notes           text,
 *     tracking_url    text,
 *     raw_create_response jsonb,
 *     last_webhook_at timestamptz,
 *     created_at      timestamptz default now()
 *   );
 *
 * If the table doesn't exist yet (pre-migration), the persist step
 * logs the error and still returns the courier response so the
 * customer flow isn't blocked.
 */
export async function POST(request: Request) {
  // R146 · freno de velocidad. Cada llamada de acá va a PedidosYa de
  // verdad: consume cuota y su propia documentación avisa que bloquean
  // 10 minutos por exceso de llamadas. Sin freno, un guión repitiendo
  // deja al local sin poder cotizar ni despachar.
  //
  // El freno ya existía en la casa y Upstash ya está pagado · sólo no
  // se estaba usando en las dos rutas que cuestan plata.
  {
    const rl = await checkRateLimit(getClientIp(request), {
      limit: 8,
      windowSec: 60,
      bucket: "courier_order",
    })
    if (!rl.ok) {
      return NextResponse.json(
        {
          error: "rate_limited",
          message:
            "Demasiados intentos seguidos. Espera un momento y vuelve a probar.",
          retryIn: rl.resetIn,
        },
        { status: 429 },
      )
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = courierOrderRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }
  const { quoteToken, dropoff, lines, notes } = parsed.data

  // R152 · el teléfono se deja en UNA sola forma antes de tocar nada.
  // Antes se guardaba tal cual lo escribía el cliente ("0997744288")
  // mientras el resto del sistema usa la forma internacional
  // ("593997744288") · el mismo cliente quedaba partido en dos y su
  // pedido nunca se cruzaba con sus perlas ni con su ficha.
  const telefono = telefonoCanonico(parsed.data.customer.phone)
  if (!telefono) {
    return NextResponse.json(
      {
        error: "telefono_invalido",
        message:
          "Ese número no parece completo. Escribe tu celular con los 10 dígitos, por ejemplo 0991234567.",
      },
      { status: 400 },
    )
  }
  const customer = { ...parsed.data.customer, phone: telefono }

  // ── R144 · cuánto tiene que cobrar el motorizado en la puerta ──────
  // La comida y el descuento los recalcula el servidor · el navegador
  // es sólo pantalla. El envío sale de una cotización propia hecha
  // ahora, no del número que mandó el teléfono.
  //
  // La propina NO entra acá a propósito: esa plata la recaudaría
  // PedidosYa y nos la liquidaría a nosotros, con lo cual le
  // quedaríamos debiendo la propina al motorizado. Va en mano.
  // R154 · el precio lo pone la casa. Antes el subtotal se "recalculaba"
  // a partir de los precios que mandaba el navegador · recalcular la
  // multiplicación no sirve de nada si el precio de cada plato lo escribe
  // quien compra. Se comprobó contra el sitio publicado: 10 encebollados
  // a $0.01 daban un subtotal de $0.10 en vez de $40, y esa es la cifra
  // que se le ordena cobrar al motorizado.
  const revision = revisarPrecios(lines)
  if (!revision.ok) {
    return NextResponse.json(
      {
        error: "precios_no_coinciden",
        message:
          "Los precios de tu pedido no coinciden con la carta. Vuelve a armarlo, por favor.",
        detail: revision.problemas.join(" · "),
      },
      { status: 400 },
    )
  }
  const comidaUsd = revision.subtotalUsd
  // R155 · el cupón se comprueba ACÁ, no sólo en la ruta que la pantalla
  // llama de buena fe. Quien mande el pedido directo se saltaba las
  // reglas y se llevaba el 5% en cada pedido, para siempre.
  const cuponPedido = parsed.data.discountCode || null
  const derecho = cuponPedido
    ? await tieneDerechoAlCupon(cuponPedido, telefono)
    : { tieneDerecho: false }
  const descuento = derecho.tieneDerecho
    ? computeDiscount(comidaUsd, cuponPedido)
    : { code: null, percentOff: 0, amountUsd: 0 }

  let envioParaCobrar: number | null = null
  try {
    const c = await getDeliveryQuote({
      dropoff,
      cartTotalUsd: comidaUsd,
      itemCount: lines.reduce((n, l) => n + l.qty, 0),
    })
    envioParaCobrar = c.priceUsd
  } catch {
    // Si nuestra propia cotización falla, usamos la que vio el cliente
    // (el esquema ya la topea en $100). Peor sería no cobrar nada.
    envioParaCobrar = parsed.data.quotedDeliveryFeeUsd ?? null
  }

  const aCobrarEnLaPuerta =
    envioParaCobrar === null
      ? 0
      : Number(
          Math.max(0, comidaUsd - descuento.amountUsd + envioParaCobrar).toFixed(2),
        )

  let courierResult
  try {
    courierResult = await createOrder({
      quoteToken,
      dropoff,
      customer,
      lines: lines.map((l) => ({ name: l.name, qty: l.qty, priceUsd: l.priceUsd })),
      notes,
      collectMoneyUsd: aCobrarEnLaPuerta,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // R144 · el proveedor topea cuánto puede cobrar un motorizado en
    // efectivo (probado 30-ago: $100 pasa, $200 no). Si el pedido lo
    // supera, el cliente merece una frase que se entienda, no el
    // código crudo del proveedor.
    if (message.includes("COLLECT_MONEY_EXCEEDED")) {
      return NextResponse.json(
        {
          error: "cobro_excede_maximo",
          message:
            "Este pedido supera el máximo que el motorizado puede cobrar en efectivo. Escríbenos por WhatsApp y lo coordinamos.",
          detail: message,
        },
        { status: 400 },
      )
    }
    const status = message.startsWith("courier_env_missing:") ? 503 : 502
    return NextResponse.json(
      { error: "order_failed", detail: message },
      { status },
    )
  }

  // Best-effort persist · don't block the customer on Supabase
  // errors. The webhook handler will create the row if it arrives
  // before this insert (idempotent on pedidosya_order_id).
  // R106 · courier_orders vive en el esquema `naufrago`, como el resto
  // del cliente. Antes apuntaba a `public` (legado R74) · esa tabla nunca
  // llegó a crearse, y de haberse creado ahí habría quedado publicada
  // hacia afuera con nombre, teléfono y dirección del cliente adentro.
  const supabase = getSupabaseAdmin()
  try {
    await supabase
      .from("courier_orders")
      .upsert(
        {
          client_slug: cliente.slug,
          pedidosya_order_id: courierResult.orderId,
          quote_token: quoteToken,
          status: courierResult.status,
          customer_name: customer.name,
          customer_phone: customer.phone,
          customer_email: customer.email || null,
          dropoff_address: dropoff.street,
          cart_lines: lines,
          notes: notes || null,
          tracking_url: courierResult.trackingUrl ?? null,
          raw_create_response: courierResult.raw as object,
        },
        { onConflict: "pedidosya_order_id" },
      )
  } catch (err) {
    // Swallow · log on the server but proceed with success response.
    console.warn("[courier-order] courier_orders persist failed", err)
  }

  // R97.5 · ALSO insert into naufrago.orders (R96 canonical table)
  // para que tracker /order/[code] + WhatsApp templates + geofencing
  // funcionen. En MOCK MODE inicializamos en ACCEPTED + payment CAPTURED
  // (simulando Kushki capture + courier dispatch). En real flow lo
  // dejaríamos PENDING hasta que llegue confirmación PedidosYa real.
  const mockMode = process.env.PEDIDOSYA_COURIER_MOCK === "true"
  // R154 · el mismo subtotal de la casa, no la suma del navegador.
  const cartTotalUsd = comidaUsd

  // R107 · el envío SÍ se cobra. Hasta hoy esta fila guardaba
  // delivery_fee_usd = 0 y total = comida, así que el pedido quedaba
  // registrado por menos de lo que costaba y la cocina veía un total
  // que no cerraba. La cifra viene del DESPACHO (route.pricing.total),
  // que es la que PedidosYa confirmó · no la del navegador ni la de
  // una re-cotización, que podrían diferir de lo cobrado.
  const deliveryFeeUsd = courierResult.priceUsd ?? 0
  // R155 · el total del pedido es EXACTAMENTE lo que se cobra: comida
  // menos descuento más envío. Antes el descuento se caía de esta cuenta.
  const totalUsd = Number(
    Math.max(0, cartTotalUsd - descuento.amountUsd + deliveryFeeUsd).toFixed(2),
  )
  const etaMinutes = courierResult.etaMinutes ?? null
  const { generateOrderCode } = await import("@/lib/checkout/order-code")
  const orderCode = generateOrderCode()
  let naufragoOrderId: string | null = null
  try {
    const { data: inserted } = await supabase
      .from("orders")
      .insert({
        client_slug: cliente.slug,
        order_code: orderCode,
        status: mockMode ? "ACCEPTED" : "PENDING",
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email || null,
        dropoff_address: dropoff.street,
        dropoff_detail: dropoff.detail || null,
        dropoff_lat: dropoff.latitude ?? null,
        dropoff_lng: dropoff.longitude ?? null,
        dropoff_country_code: dropoff.countryCode ?? "EC",
        cart_lines: lines,
        subtotal_usd: cartTotalUsd,
        // R155 · el descuento se le restaba a lo que cobra el motorizado
        // pero NO se guardaba · el motorizado cobraba $40.50 y la ficha
        // decía $42.50. Los libros no cerraban contra la plata.
        discount_code: descuento.code,
        discount_usd: descuento.amountUsd,
        delivery_fee_usd: deliveryFeeUsd,
        total_usd: totalUsd,
        // R145 · la propina va aparte, NO dentro del total: no es plata
        // del local. Mezclarla inflaría los ingresos y la contabilidad
        // no cerraría contra la caja.
        tip_usd: parsed.data.tipUsd ?? 0,
        delivery_eta_minutes: etaMinutes,
        delivery_provider: "PEDIDOSYA_COURIER",
        delivery_provider_order_id: courierResult.orderId,
        delivery_provider_tracking_url: courierResult.trackingUrl ?? null,
        delivery_quote_token: quoteToken,
        // R107 · antes decía "CARD_DEBIT" fijo · era falso: no hay
        // pasarela de tarjeta conectada, así que ningún pedido se pagó
        // con débito. La cocina lo leía como cobrado por adelantado.
        // Lo que existe hoy es efectivo contra entrega.
        payment_method: "CASH_ON_DELIVERY",
        payment_status: mockMode ? "CAPTURED" : "PENDING",
        payment_provider: mockMode ? "KUSHKI" : null,
        customer_notes: notes || null,
        accepted_at: mockMode ? new Date().toISOString() : null,
        raw_dispatch_response: courierResult.raw as object,
      })
      .select("id, order_code")
      .single()
    if (inserted) {
      naufragoOrderId = inserted.id

      // R134 · ACÁ IBA EL AVISO POR WHATSAPP A LA COCINA (R110) · se
      // eliminó por decisión de Emilio: la pantalla de pedidos ya muestra
      // todo lo que ese mensaje decía -qué cocinar, la dirección y cuánto
      // cobrar- y encima avisa con sonido cuando entra uno nuevo. Dos
      // avisos para lo mismo es un aviso de más.
      //
      // A CAMBIO, la pantalla pasa a ser el ÚNICO camino: si la tablet
      // está apagada o sin internet, nadie en el local se entera. Antes el
      // WhatsApp era la red de abajo.
      //
      // El aviso nunca llegó a probarse con un pedido real: en el historial
      // hay 13 movimientos y ninguno es "cocina avisada". No se está
      // apagando algo que funcionaba.
      //
      // Vuelve en un commit si hace falta · ver R110 en el historial.

      // ─── RESTAURADO R110.2 · esto lo borré yo al reescribir el bloque
      // en R110.1 y estuvo ausente dos publicaciones. Sin esto el cliente
      // no recibía su primer aviso y el pedido no quedaba registrado en su
      // propio historial.
      //
      // El aviso al CLIENTE también se espera ahora, por la misma razón
      // que el de la cocina: con `void` la función se apaga al responder y
      // se lo lleva puesto.
      // R147 · esta se llamaba al sitio público aunque corriera en una
      // vista previa · probar un cambio disparaba avisos en producción.
      const origin = origenPropio()
      await fetch(`${origin}/api/notifications/order-status`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderCode, newStatus: "ACCEPTED" }),
      }).catch(() => {})

      await supabase
        .from("order_events")
        .insert({
          order_id: inserted.id,
          event_type: "ORDER_CREATED",
          actor: "system",
          payload: {
            mock_mode: mockMode,
            subtotal_usd: cartTotalUsd,
            delivery_fee_usd: deliveryFeeUsd,
            total_usd: totalUsd,
          },
        })
        .then(undefined, () => {})
    }
  } catch (err) {
    console.warn("[courier-order] naufrago.orders persist failed", err)
  }

  return NextResponse.json({
    ok: true,
    orderId: courierResult.orderId,
    orderCode,
    naufragoOrderId,
    trackingUrl: courierResult.trackingUrl,
    status: courierResult.status,
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/courier/order",
    method: "POST",
    runtime: "nodejs",
    description:
      "PedidosYa Courier · promote quote to real delivery order · persists to courier_orders.",
    body_shape: {
      quoteToken: "string · from /api/courier/quote",
      dropoff: "address object",
      customer: "{ name, phone, email? }",
      lines: "cart lines array",
      notes: "string (optional)",
    },
  })
}
