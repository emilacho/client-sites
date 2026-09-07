/**
 * pago-antes-de-despachar.test.ts · R164
 *
 * LA REGLA QUE ESTAS PRUEBAS CUIDAN
 * Con efectivo el pedido sale primero y el motorizado cobra en la
 * puerta. Con tarjeta el orden es al revés: primero entra la plata,
 * después sale la comida.
 *
 * Si esa regla se invierte por accidente, el local manda comida a la
 * calle sin haber cobrado y sin nadie que cobre al llegar · y nadie se
 * entera hasta que falte plata en la caja. Por eso se prueba acá y no
 * "cuando haya un pedido real".
 *
 * Verifica:
 *   1. reservar NO le avisa al motorizado
 *   2. reservar SÍ revisa todo lo demás (precios · horario)
 *   3. sin reservar, el comportamiento de siempre no cambió
 *   4. no se despacha un pedido que no está cobrado
 *   5. no se despacha dos veces el mismo pedido
 *   6. si la cotización se venció mientras pagaban, se pide una nueva
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const {
  mockCreateOrder,
  mockGetDeliveryQuote,
  filaPedido,
  fichaGuardada,
  mockUpdate,
} = vi.hoisted(() => ({
  mockCreateOrder: vi.fn(),
  mockGetDeliveryQuote: vi.fn(),
  /** Lo que devuelve la búsqueda de un pedido ya existente. */
  filaPedido: { valor: null as Record<string, unknown> | null },
  /** Lo que devuelve GUARDAR la ficha · se puede hacer fallar a propósito. */
  fichaGuardada: {
    valor: { id: "uuid-1", order_code: "NF-2609-ABC123" } as unknown,
    error: null as { message: string } | null,
  },
  mockUpdate: vi.fn(),
}))

vi.mock("@/lib/courier/para-rutas", () => ({
  createOrder: (...a: unknown[]) => mockCreateOrder(...a),
  getDeliveryQuote: (...a: unknown[]) => mockGetDeliveryQuote(...a),
}))

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => {
    const chain: Record<string, unknown> = {}
    const self = () => chain
    Object.assign(chain, {
      from: self,
      upsert: async () => ({ data: null, error: null }),
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: fichaGuardada.error ? null : fichaGuardada.valor,
            error: fichaGuardada.error,
          }),
        }),
        then: (r: (v: unknown) => void) => r({ data: null, error: null }),
      }),
      update: (...a: unknown[]) => {
        mockUpdate(...a)
        return chain
      },
      eq: self,
      select: self,
      limit: async () => ({ data: [], error: null }),
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: filaPedido.valor, error: null }),
    })
    return chain
  },
}))

import { POST } from "../app/api/courier/order/route"
import { despacharPedidoPagado } from "../lib/checkout/despachar-pagado"

const pedido = (extra: Record<string, unknown> = {}) =>
  new Request("http://localhost:3000/api/courier/order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteToken: "tok-1",
      dropoff: {
        street: "Cdla Kennedy",
        countryCode: "EC",
        latitude: -2.155,
        longitude: -79.902,
      },
      customer: { name: "Cliente", phone: "+593997744288" },
      lines: [
        {
          id: "encebollado-naufrago",
          name: "Encebollado Náufrago",
          priceUsd: 4,
          qty: 2,
        },
      ],
      ...extra,
    }),
  })

/** Una ficha de pedido reservado, como la deja la reserva. */
const fichaReservada = (extra: Record<string, unknown> = {}) => ({
  id: "uuid-1",
  order_code: "NF-2609-ABC123",
  status: "PENDING_PAYMENT",
  payment_status: "CAPTURED",
  delivery_provider_order_id: null,
  delivery_provider_tracking_url: null,
  delivery_quote_token: "tok-guardado",
  customer_name: "Cliente",
  customer_phone: "593997744288",
  customer_email: null,
  dropoff_address: "Cdla Kennedy",
  dropoff_detail: null,
  dropoff_lat: -2.155,
  dropoff_lng: -79.902,
  dropoff_country_code: "EC",
  cart_lines: [{ name: "Encebollado Náufrago", qty: 2, priceUsd: 4 }],
  customer_notes: null,
  subtotal_usd: 8,
  ...extra,
})

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-07T15:00:00Z")) // lunes 10:00 en la cocina
  vi.clearAllMocks()
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")))
  filaPedido.valor = null
  fichaGuardada.error = null
  mockGetDeliveryQuote.mockResolvedValue({
    quoteToken: "tok-nuevo",
    priceUsd: 2.5,
    etaMinutes: 0,
    expiresAt: new Date().toISOString(),
    raw: {},
  })
  mockCreateOrder.mockResolvedValue({
    orderId: "py-1",
    status: "CONFIRMED",
    priceUsd: 2.5,
    etaMinutes: 30,
    raw: {},
  })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("reservar sin despachar · R164", () => {
  it("con tarjeta NO se le avisa al motorizado", async () => {
    const res = await POST(pedido({ soloReservar: true }))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.reservado).toBe(true)
    expect(json.status).toBe("PENDING_PAYMENT")
    expect(mockCreateOrder).not.toHaveBeenCalled()
  })

  it("la reserva devuelve el código y el total a cobrar", async () => {
    const json = await (await POST(pedido({ soloReservar: true }))).json()
    expect(json.orderCode).toMatch(/^NF-\d{4}-[0-9A-F]{6}$/)
    expect(json.totalUsd).toBe(10.5) // $8 de comida + $2.50 de envío
  })

  it("reservar NO se saltea las revisiones · precios inventados se rechazan", async () => {
    const res = await POST(
      pedido({
        soloReservar: true,
        lines: [
          {
            id: "encebollado-naufrago",
            name: "Encebollado Náufrago",
            priceUsd: 0.5,
            qty: 2,
          },
        ],
      }),
    )
    expect(res.status).toBe(400)
    expect(mockCreateOrder).not.toHaveBeenCalled()
  })

  it("si la ficha no se puede guardar, la reserva FALLA · no se cobra a ciegas", async () => {
    // El caso real que esto cuida: la base rechaza el estado nuevo
    // porque falta aplicar el cambio de estructura. Antes el pedido
    // habría seguido adelante y se le habría cobrado al cliente por un
    // pedido que no existe en ningún lado.
    fichaGuardada.error = { message: "violates check constraint" }
    const res = await POST(pedido({ soloReservar: true }))
    expect(res.status).toBe(503)
    expect((await res.json()).error).toBe("reserva_fallida")
  })

  it("sin la bandera, el efectivo sigue despachando como siempre", async () => {
    const json = await (await POST(pedido())).json()
    expect(mockCreateOrder).toHaveBeenCalledTimes(1)
    expect(json.reservado).toBeFalsy()
  })
})

describe("despachar recién después del cobro · R164", () => {
  it("no despacha un pedido que no está cobrado", async () => {
    filaPedido.valor = fichaReservada({ payment_status: "PENDING" })
    const r = await despacharPedidoPagado("NF-2609-ABC123")
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe("pedido_no_pagado")
    expect(mockCreateOrder).not.toHaveBeenCalled()
  })

  it("no despacha dos veces · si el cliente recarga la pantalla de vuelta", async () => {
    filaPedido.valor = fichaReservada({
      delivery_provider_order_id: "py-ya-existe",
      delivery_provider_tracking_url: "https://track/1",
    })
    const r = await despacharPedidoPagado("NF-2609-ABC123")
    expect(r.ok).toBe(true)
    expect(r.yaEstaba).toBe(true)
    expect(mockCreateOrder).not.toHaveBeenCalled()
  })

  it("cobrado y sin despachar · sale, y el motorizado NO cobra nada en la puerta", async () => {
    filaPedido.valor = fichaReservada()
    const r = await despacharPedidoPagado("NF-2609-ABC123")
    expect(r.ok).toBe(true)
    expect(mockCreateOrder.mock.calls[0][0].collectMoneyUsd).toBe(0)
    expect(mockCreateOrder.mock.calls[0][0].quoteToken).toBe("tok-guardado")
  })

  it("si la cotización se venció mientras pagaba, pide una nueva y despacha igual", async () => {
    filaPedido.valor = fichaReservada()
    mockCreateOrder
      .mockRejectedValueOnce(new Error("quote_expired"))
      .mockResolvedValueOnce({
        orderId: "py-2",
        status: "CONFIRMED",
        priceUsd: 3,
        etaMinutes: 30,
        raw: {},
      })
    const r = await despacharPedidoPagado("NF-2609-ABC123")
    expect(r.ok).toBe(true)
    expect(mockGetDeliveryQuote).toHaveBeenCalled()
    expect(mockCreateOrder.mock.calls[1][0].quoteToken).toBe("tok-nuevo")
  })

  it("si el despacho falla igual · la plata ya entró · el pedido queda marcado a mano", async () => {
    filaPedido.valor = fichaReservada()
    mockCreateOrder.mockRejectedValue(new Error("proveedor caído"))
    const r = await despacharPedidoPagado("NF-2609-ABC123")
    expect(r.ok).toBe(false)
    expect(
      mockUpdate.mock.calls.some(
        (c) => (c[0] as { status?: string })?.status === "NEEDS_ATTENTION",
      ),
    ).toBe(true)
  })
})
