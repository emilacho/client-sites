/**
 * ciclo-completo-tarjeta.test.ts · R168
 *
 * EL CICLO ENTERO DE UN PEDIDO PAGADO CON TARJETA, DE PUNTA A PUNTA.
 *
 * No se puede hacer todavía con plata real: falta el probador de
 * PayPhone y el local abierto. Pero sí se puede hacer con todo el
 * código real y una base que guarda de verdad · que es donde viven los
 * errores que un cobro real destaparía tarde y caro.
 *
 * Los cuatro momentos, en orden:
 *
 *   1 · El cliente arma el pedido y elige tarjeta
 *       → se RESERVA · no sale a la calle, no le avisa a nadie
 *   2 · Paga en el formulario de PayPhone
 *       → vuelve a nuestra pantalla de confirmación
 *   3 · Se confirma el cobro contra PayPhone
 *       → el pedido queda marcado como pagado
 *   4 · Recién ahí se le pide el motorizado
 *       → y el motorizado NO cobra nada en la puerta
 *
 * Lo único de mentira son PedidosYa y PayPhone. La base guarda estado
 * real, así que lo que escribe un paso lo lee el siguiente · si un
 * campo no coincide entre dos pasos, esta prueba se cae. Las pruebas
 * de un solo paso no pueden ver eso.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { BaseFalsa } from "./ayudas/base-falsa"

const { base, mockCreateOrder, mockGetDeliveryQuote, mockConfirmar, avisos } =
  vi.hoisted(() => ({
    base: { actual: null as unknown },
    mockCreateOrder: vi.fn(),
    mockGetDeliveryQuote: vi.fn(),
    mockConfirmar: vi.fn(),
    avisos: { lista: [] as string[] },
  }))

vi.mock("@/lib/courier/para-rutas", () => ({
  createOrder: (...a: unknown[]) => mockCreateOrder(...a),
  getDeliveryQuote: (...a: unknown[]) => mockGetDeliveryQuote(...a),
}))

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => base.actual,
}))

vi.mock("@/lib/pagos/payphone", async (original) => {
  const real = await original<Record<string, unknown>>()
  return {
    ...real,
    confirmarCobro: (...a: unknown[]) => mockConfirmar(...a),
    payphoneEncendido: () => true,
    payphoneConfigurado: () => true,
  }
})

import { POST as crearPedido } from "../app/api/courier/order/route"
import { despacharPedidoPagado } from "../lib/checkout/despachar-pagado"
import { confirmarCobro } from "../lib/pagos/payphone"

const CLIENTE = { name: "Ana Vera", phone: "+593987654321" }
const DIRECCION = {
  street: "Cdla Kennedy Norte, Mz 3 Villa 7",
  detail: "Casa celeste, portón negro",
  countryCode: "EC",
  latitude: -2.155,
  longitude: -79.902,
}

const cuerpoPedido = (extra: Record<string, unknown> = {}) =>
  new Request("http://localhost:3000/api/courier/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteToken: "cotizacion-abc",
      dropoff: DIRECCION,
      customer: CLIENTE,
      lines: [
        { id: "encebollado-naufrago", name: "Encebollado Náufrago", priceUsd: 4, qty: 2 },
        { id: "ceviche-naufrago", name: "Ceviche Náufrago", priceUsd: 7, qty: 1 },
      ],
      tipUsd: 2,
      notes: "Sin cebolla por favor",
      ...extra,
    }),
  })

/** Lo que hace nuestra pantalla de vuelta de PayPhone, sin dibujarla. */
async function volverDePayphone(orderCode: string, supa: BaseFalsa) {
  const r = await confirmarCobro(12345, orderCode)
  if ("error" in r || !r.aprobado) throw new Error("el cobro no se aprobó")

  const { data } = await supa
    .from("orders")
    .select("id, payment_status")
    .eq("client_slug", "naufrago")
    .eq("order_code", orderCode)
    .maybeSingle()
  const fila = data as { id: string; payment_status: string } | null
  if (!fila) throw new Error("el pedido no existe")
  if (fila.payment_status === "CAPTURED") return { yaEstaba: true }

  await supa
    .from("orders")
    .update({
      payment_status: "CAPTURED",
      payment_method: "PAYPHONE",
      payment_provider: "PAYPHONE",
      payment_provider_intent_id: String(r.transactionId),
    })
    .eq("id", fila.id)
  return { yaEstaba: false }
}

let supa: BaseFalsa

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-07T15:00:00Z")) // lunes 10:00 en la cocina
  vi.clearAllMocks()
  avisos.lista = []

  supa = new BaseFalsa()
  base.actual = supa

  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      avisos.lista.push(String(url))
      return new Response("{}")
    }),
  )

  mockGetDeliveryQuote.mockResolvedValue({
    quoteToken: "cotizacion-abc",
    priceUsd: 2.5,
    etaMinutes: 0,
    expiresAt: new Date().toISOString(),
    raw: {},
  })
  mockCreateOrder.mockResolvedValue({
    orderId: "PY-99887",
    status: "CONFIRMED",
    trackingUrl: "https://pedidosya.test/seguir/99887",
    priceUsd: 2.5,
    etaMinutes: 32,
    raw: { ok: true },
  })
  mockConfirmar.mockResolvedValue({
    aprobado: true,
    transactionId: 12345,
    montoCentavos: 1750,
    codigoAutorizacion: "AUT-777",
    ultimosDigitos: "4242",
    marcaTarjeta: "Visa",
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("ciclo completo de un pedido con tarjeta · R168", () => {
  it("recorre los cuatro momentos y termina con la comida en camino", async () => {
    // ── 1 · el cliente pide y elige tarjeta ───────────────────────────
    const res = await crearPedido(cuerpoPedido({ soloReservar: true }))
    const reserva = await res.json()

    expect(res.status).toBe(200)
    expect(reserva.reservado).toBe(true)
    // $8 + $7 de comida + $2.50 de envío · la propina de $2 NO entra.
    expect(reserva.totalUsd).toBe(17.5)

    // Nadie salió a la calle todavía.
    expect(mockCreateOrder).not.toHaveBeenCalled()
    // Y no se le avisó a nadie · ni al cliente ni a la cocina.
    expect(avisos.lista.filter((u) => u.includes("notifications"))).toHaveLength(0)

    const guardado = supa.filas("orders")[0]
    expect(guardado.status).toBe("PENDING_PAYMENT")
    expect(guardado.payment_status).toBe("PENDING")
    expect(guardado.delivery_provider_order_id).toBeNull()
    // La propina quedó anotada aparte, no dentro del total.
    expect(guardado.tip_usd).toBe(2)
    expect(guardado.total_usd).toBe(17.5)

    // ── 2 y 3 · paga y vuelve · se confirma contra PayPhone ───────────
    const vuelta = await volverDePayphone(reserva.orderCode, supa)
    expect(vuelta.yaEstaba).toBe(false)
    expect(mockConfirmar).toHaveBeenCalledWith(12345, reserva.orderCode)

    const pagado = supa.filas("orders")[0]
    expect(pagado.payment_status).toBe("CAPTURED")
    expect(pagado.payment_method).toBe("PAYPHONE")

    // ── 4 · recién ahora sale a la calle ──────────────────────────────
    const salida = await despacharPedidoPagado(String(reserva.orderCode))
    expect(salida.ok).toBe(true)

    const enviado = mockCreateOrder.mock.calls[0][0]
    // Ya está pagado · el motorizado NO cobra nada en la puerta.
    expect(enviado.collectMoneyUsd).toBe(0)
    // Y lleva la dirección y las notas que el cliente puso en el paso 1 ·
    // esto es lo que ninguna prueba de un solo paso puede comprobar.
    expect(enviado.dropoff.street).toBe(DIRECCION.street)
    expect(enviado.dropoff.detail).toBe(DIRECCION.detail)
    expect(enviado.notes).toBe("Sin cebolla por favor")
    expect(enviado.customer.name).toBe(CLIENTE.name)
    expect(enviado.lines).toHaveLength(2)

    const final = supa.filas("orders")[0]
    expect(final.status).toBe("PENDING")
    expect(final.delivery_provider_order_id).toBe("PY-99887")
    expect(final.delivery_provider_tracking_url).toBe("https://pedidosya.test/seguir/99887")
    expect(final.delivery_eta_minutes).toBe(32)

    // Y AHORA sí se le avisa al cliente · no antes.
    expect(avisos.lista.some((u) => u.includes("order-status"))).toBe(true)
  })

  it("si el cliente recarga la pantalla de vuelta, no se cobra ni se despacha dos veces", async () => {
    const reserva = await (await crearPedido(cuerpoPedido({ soloReservar: true }))).json()

    await volverDePayphone(reserva.orderCode, supa)
    await despacharPedidoPagado(String(reserva.orderCode))

    // El cliente aprieta F5 · todo el camino se recorre otra vez.
    const segunda = await volverDePayphone(reserva.orderCode, supa)
    const segundoDespacho = await despacharPedidoPagado(String(reserva.orderCode))

    expect(segunda.yaEstaba).toBe(true)
    expect(segundoDespacho.ok).toBe(true)
    expect(segundoDespacho.yaEstaba).toBe(true)
    // Un solo envío pedido en toda la historia.
    expect(mockCreateOrder).toHaveBeenCalledTimes(1)
    expect(supa.filas("orders")).toHaveLength(1)
  })

  it("si el cliente nunca paga, el pedido se queda quieto y nadie cocina nada", async () => {
    const reserva = await (await crearPedido(cuerpoPedido({ soloReservar: true }))).json()

    // No vuelve de PayPhone · abandonó. Alguien intenta despacharlo igual.
    const salida = await despacharPedidoPagado(String(reserva.orderCode))

    expect(salida.ok).toBe(false)
    expect(salida.motivo).toBe("pedido_no_pagado")
    expect(mockCreateOrder).not.toHaveBeenCalled()
    expect(supa.filas("orders")[0].status).toBe("PENDING_PAYMENT")
    expect(avisos.lista.filter((u) => u.includes("notifications"))).toHaveLength(0)
  })

  it("si la cotización se venció mientras pagaba, se pide otra y el pedido sale igual", async () => {
    const reserva = await (await crearPedido(cuerpoPedido({ soloReservar: true }))).json()
    await volverDePayphone(reserva.orderCode, supa)

    mockCreateOrder
      .mockRejectedValueOnce(new Error("quote_expired"))
      .mockResolvedValueOnce({
        orderId: "PY-99888",
        status: "CONFIRMED",
        priceUsd: 3,
        etaMinutes: 40,
        raw: {},
      })
    mockGetDeliveryQuote.mockResolvedValueOnce({
      quoteToken: "cotizacion-nueva",
      priceUsd: 3,
      etaMinutes: 0,
      expiresAt: new Date().toISOString(),
      raw: {},
    })

    const salida = await despacharPedidoPagado(String(reserva.orderCode))

    expect(salida.ok).toBe(true)
    expect(mockCreateOrder.mock.calls[1][0].quoteToken).toBe("cotizacion-nueva")
    expect(supa.filas("orders")[0].delivery_provider_order_id).toBe("PY-99888")
  })

  it("cobrado y sin poder despachar · queda en rojo para la cocina, no se pierde", async () => {
    const reserva = await (await crearPedido(cuerpoPedido({ soloReservar: true }))).json()
    await volverDePayphone(reserva.orderCode, supa)

    mockCreateOrder.mockRejectedValue(new Error("proveedor caído"))
    const salida = await despacharPedidoPagado(String(reserva.orderCode))

    expect(salida.ok).toBe(false)
    const fila = supa.filas("orders")[0]
    expect(fila.status).toBe("NEEDS_ATTENTION")
    // La plata entró · eso no se pierde de vista.
    expect(fila.payment_status).toBe("CAPTURED")
    // Y queda anotado por qué, para poder reclamar o reversar.
    const evento = supa
      .filas("order_events")
      .find((e) => e.event_type === "DISPATCH_FAILED_AFTER_PAYMENT")
    expect(evento).toBeTruthy()
  })

  it("el mismo pedido en efectivo sigue saliendo derecho, sin pasar por el cobro", async () => {
    const res = await crearPedido(cuerpoPedido())
    const json = await res.json()

    expect(json.reservado).toBeFalsy()
    expect(mockCreateOrder).toHaveBeenCalledTimes(1)
    // Acá sí cobra en la puerta · comida + envío, sin la propina.
    expect(mockCreateOrder.mock.calls[0][0].collectMoneyUsd).toBe(17.5)
    expect(supa.filas("orders")[0].payment_method).toBe("CASH_ON_DELIVERY")
  })
})
