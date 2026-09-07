/**
 * propina-siempre-en-efectivo.test.ts · R167
 *
 * LA DECISIÓN QUE ESTAS PRUEBAS CUIDAN (Emilio · 08-sep)
 * La propina es del motorizado y nunca se cobra por internet. El cliente
 * la elige al pedir, pero se la entrega en la mano, pague como pague.
 *
 * Cobrarla con la tarjeta la haría entrar a la cuenta del local, y
 * después habría que hacérsela llegar al motorizado · le quedaríamos
 * debiendo. Ese es exactamente el lío que la decisión evita.
 *
 * Lo que se prueba acá es la mitad de la plata: que la propina no se
 * cuele NUNCA en lo que se cobra, ni por la puerta ni por la tarjeta.
 * La mitad de la pantalla -que la cocina no entregue plata de su
 * bolsillo- vive en app/cocina/page.tsx y se cuida con la revisión.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { mockCreateOrder, mockGetDeliveryQuote, insertado } = vi.hoisted(() => ({
  mockCreateOrder: vi.fn(),
  mockGetDeliveryQuote: vi.fn(),
  insertado: { fila: null as Record<string, unknown> | null },
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
      insert: (fila: Record<string, unknown>) => {
        // Sólo interesa la ficha del pedido, no los eventos.
        if (fila && "order_code" in fila) insertado.fila = fila
        return {
          select: () => ({
            single: async () => ({
              data: { id: "uuid-1", order_code: fila?.order_code },
              error: null,
            }),
          }),
          then: (r: (v: unknown) => void) => r({ data: null, error: null }),
        }
      },
      update: self,
      eq: self,
      select: self,
      limit: async () => ({ data: [], error: null }),
      single: async () => ({ data: null, error: null }),
      maybeSingle: async () => ({ data: null, error: null }),
    })
    return chain
  },
}))

import { POST } from "../app/api/courier/order/route"

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
      tipUsd: 3,
      ...extra,
    }),
  })

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date("2026-09-07T15:00:00Z")) // lunes 10:00 en la cocina
  vi.clearAllMocks()
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")))
  insertado.fila = null
  mockGetDeliveryQuote.mockResolvedValue({
    quoteToken: "tok-1",
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

describe("la propina nunca se cobra · R167", () => {
  it("en efectivo · el motorizado cobra la comida y el envío, sin la propina", async () => {
    await POST(pedido())
    // $8 de comida + $2.50 de envío · los $3 de propina NO están.
    expect(mockCreateOrder.mock.calls[0][0].collectMoneyUsd).toBe(10.5)
  })

  it("con tarjeta · el monto a cobrar tampoco la incluye", async () => {
    const json = await (await POST(pedido({ soloReservar: true }))).json()
    // Lo que se le va a cobrar a la tarjeta es este total.
    expect(json.totalUsd).toBe(10.5)
  })

  it("la propina queda anotada aparte · el motorizado tiene que recibirla", async () => {
    await POST(pedido())
    expect(insertado.fila?.tip_usd).toBe(3)
    // Y no está sumada al total del local · si lo estuviera, los libros
    // dirían que el local ganó plata que es del motorizado.
    expect(insertado.fila?.total_usd).toBe(10.5)
  })

  it("una propina enorme no arrastra el cobro · sigue siendo la comida más el envío", async () => {
    await POST(pedido({ tipUsd: 50 }))
    expect(mockCreateOrder.mock.calls[0][0].collectMoneyUsd).toBe(10.5)
    expect(insertado.fila?.tip_usd).toBe(50)
  })
})
