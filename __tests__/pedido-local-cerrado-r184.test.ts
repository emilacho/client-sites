/** R184 · con el local cerrado, la ruta de pedido rechaza aunque llegue la cabecera vieja de prueba y no despacha a nadie. */
import { afterEach, describe, expect, it, vi } from "vitest"

const createOrder = vi.fn()
vi.mock("@/lib/courier/para-rutas", () => ({ createOrder, getDeliveryQuote: vi.fn() }))
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => {
    const q = { select: () => q, eq: () => q, maybeSingle: () => Promise.resolve({ data: null, error: null }) }
    return { from: () => q }
  },
}))
afterEach(() => { vi.useRealTimers(); createOrder.mockClear() })

describe("R184 · /api/courier/order con el local cerrado", () => {
  it("la cabecera y la marca de prueba no abren el local", async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-11T22:00:00Z")) // miércoles 17:00 en Ecuador, pasada la apertura temporal
    const { POST } = await import("@/app/api/courier/order/route")
    const res = await POST(new Request("http://x/api/courier/order", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-naufrago-prueba": "1" },
      body: JSON.stringify({
        quoteToken: "t", esPrueba: true,
        customer: { name: "Ana Prueba", phone: "0991234567" },
        dropoff: { street: "Calle 1", city: "Guayaquil", latitude: -2.17, longitude: -79.92 },
        lines: [{ id: "ceviche-naufrago", name: "Ceviche", priceUsd: 10, qty: 1 }],
      }),
    }))
    const cuerpo = await res.json()
    expect(cuerpo.error).toBe("local_cerrado")
    expect(createOrder).not.toHaveBeenCalled()
  })
})
