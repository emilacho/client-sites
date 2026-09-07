import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { payphoneEncendido, aCentavos } from "@/lib/pagos/payphone"
import { cliente } from "@/cliente.config"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"

/**
 * POST /api/pago/preparar · R164
 *
 * Le entrega a la pantalla lo que necesita para dibujar el formulario de
 * pago de PayPhone · y NADA de eso lo pone el navegador.
 *
 * POR QUÉ EL MONTO NO VIENE DEL NAVEGADOR
 * Es la misma lección que los precios (R154) y el cupón (R155): si el
 * monto a cobrar lo mandara la pantalla, el cliente podría pagar $0.10
 * por un pedido de $40. Acá se lee de la ficha del pedido, que ya la
 * escribió el servidor con los precios de la casa.
 *
 * EL TOKEN SÍ VA AL NAVEGADOR · y está bien
 * El formulario de PayPhone corre en la página del cliente y necesita el
 * token ahí. Por eso ellos lo atan al DOMINIO: ese token sólo funciona
 * en naufrago.ec · en cualquier otro sitio devuelve acceso denegado. Se
 * sirve desde acá y no incrustado en el código para poder cambiarlo sin
 * volver a publicar.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const rl = await checkRateLimit(getClientIp(request), {
    limit: 10,
    windowSec: 60,
    bucket: "pago_preparar",
  })
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 })
  }

  if (!payphoneEncendido()) {
    return NextResponse.json(
      { error: "pago_no_disponible", message: "El pago con tarjeta no está disponible por ahora." },
      { status: 503 },
    )
  }

  let body: { orderCode?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }
  const orderCode = typeof body.orderCode === "string" ? body.orderCode : ""
  if (!/^NF-\d{4}-[0-9A-F]{6}$/i.test(orderCode)) {
    return NextResponse.json({ error: "pedido_invalido" }, { status: 400 })
  }

  const supa = getSupabaseAdmin()
  const { data } = await supa
    .from("orders")
    .select("order_code, total_usd, payment_status, customer_phone, customer_email, status")
    .eq("client_slug", cliente.slug)
    .eq("order_code", orderCode.toUpperCase())
    .maybeSingle()
  const pedido = data as {
    order_code: string
    total_usd: number
    payment_status: string
    customer_phone: string | null
    customer_email: string | null
    status: string
  } | null

  if (!pedido) {
    return NextResponse.json({ error: "pedido_no_encontrado" }, { status: 404 })
  }
  // Un pedido ya pagado no se vuelve a cobrar · si el cliente recarga la
  // pantalla de pago, se le dice que ya está.
  if (pedido.payment_status === "CAPTURED") {
    return NextResponse.json({ error: "ya_pagado", orderCode: pedido.order_code }, { status: 409 })
  }
  if (pedido.status === "CANCELLED") {
    return NextResponse.json({ error: "pedido_cancelado" }, { status: 409 })
  }

  const total = Number(pedido.total_usd ?? 0)
  if (!(total > 0)) {
    return NextResponse.json({ error: "monto_invalido" }, { status: 409 })
  }

  return NextResponse.json({
    ok: true,
    token: process.env.PAYPHONE_TOKEN,
    storeId: process.env.PAYPHONE_STORE_ID,
    clientTransactionId: pedido.order_code,
    // PayPhone maneja centavos · $6.50 va como 650.
    // La comida de un restaurante no lleva IVA desglosado acá: el total
    // va entero en `amountWithoutTax` y `tax` en 0. Si mañana hay que
    // desglosarlo, la suma tiene que seguir dando `amount` exacto o
    // PayPhone rechaza la transacción.
    amount: aCentavos(total),
    amountWithoutTax: aCentavos(total),
    amountWithTax: 0,
    tax: 0,
    service: 0,
    tip: 0,
    currency: "USD",
    reference: `Pedido ${pedido.order_code} · Náufrago`,
    phoneNumber: pedido.customer_phone ? `+${pedido.customer_phone}` : undefined,
    email: pedido.customer_email ?? undefined,
    lang: "es",
    timeZone: -5,
  })
}
