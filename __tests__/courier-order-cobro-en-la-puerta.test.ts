/**
 * courier-order-cobro-en-la-puerta.test.ts · R144
 *
 * El motorizado tiene que cobrar en la puerta EXACTAMENTE lo que el
 * cliente vio: comida − descuento + envío. Y la propina NUNCA va ahí:
 * esa plata la recaudaría el proveedor y nos la liquidaría a nosotros,
 * con lo cual le quedaríamos debiendo la propina al motorizado.
 *
 * Verifica:
 *   1. sin cupón · cobra comida + envío
 *   2. con cupón · el servidor re-calcula el descuento y lo resta
 *   3. la propina NO entra en lo que se cobra
 *   4. el navegador no puede mentir: si manda un envío falso, gana la
 *      cotización que hace el servidor
 *   5. si la cotización propia falla, se usa la del navegador (respaldo)
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { mockCreateOrder, mockGetDeliveryQuote } = vi.hoisted(() => ({
  mockCreateOrder: vi.fn(),
  mockGetDeliveryQuote: vi.fn(),
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
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: self,
      eq: self,
      select: self,
      single: async () => ({ data: null, error: null }),
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
      dropoff: { street: "Cdla Kennedy", countryCode: "EC", latitude: -2.155, longitude: -79.902 },
      customer: { name: "Cliente", phone: "+593997744288" },
      lines: [{ id: "encebollado", name: "Encebollado", priceUsd: 4, qty: 2 }],
      ...extra,
    }),
  })

/** Lo que se le ordenó cobrar al motorizado en la última llamada. */
const cobrado = () => mockCreateOrder.mock.calls.at(-1)?.[0]?.collectMoneyUsd

beforeEach(() => {
  vi.clearAllMocks()
  mockGetDeliveryQuote.mockResolvedValue({
    quoteToken: "tok-1", priceUsd: 2.5, etaMinutes: 0,
    expiresAt: new Date().toISOString(), raw: {},
  })
  mockCreateOrder.mockResolvedValue({
    orderId: "py-1", status: "CONFIRMED", priceUsd: 2.5, etaMinutes: 30, raw: {},
  })
})

describe("cuánto cobra el motorizado en la puerta · R144", () => {
  it("sin cupón · cobra la comida más el envío", async () => {
    await POST(pedido())
    expect(cobrado()).toBe(10.5) // $8 + $2.50
  })

  it("con cupón · el servidor re-calcula el descuento y lo resta", async () => {
    await POST(pedido({ discountCode: "SURFBOLLADO" }))
    expect(cobrado()).toBe(10.1) // $8 − $0.40 + $2.50
  })

  it("la propina NO entra en lo que se cobra en la puerta", async () => {
    await POST(pedido({ tipUsd: 5 }))
    expect(cobrado()).toBe(10.5) // los $5 no aparecen por ningún lado
  })

  it("el navegador no puede mentir sobre el envío", async () => {
    await POST(pedido({ quotedDeliveryFeeUsd: 0 }))
    expect(cobrado()).toBe(10.5) // gana la cotización del servidor
  })

  it("si nuestra cotización falla, se usa la del navegador como respaldo", async () => {
    mockGetDeliveryQuote.mockRejectedValue(new Error("proveedor caído"))
    await POST(pedido({ quotedDeliveryFeeUsd: 3.25 }))
    expect(cobrado()).toBe(11.25) // $8 + $3.25
  })

  it("si la cotización falla y el navegador no mandó nada, no inventa un monto", async () => {
    mockGetDeliveryQuote.mockRejectedValue(new Error("proveedor caído"))
    await POST(pedido())
    expect(cobrado()).toBe(0)
  })
})
