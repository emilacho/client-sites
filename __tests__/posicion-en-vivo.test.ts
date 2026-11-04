/**
 * posicion-en-vivo.test.ts · 28-oct
 *
 * El tracker usa la posición REAL del motorizado (la consulta al proveedor)
 * y no una estimación por reloj.
 *
 *   1. un pedido que aún no sale (PENDING) no consulta al proveedor
 *   2. una posición guardada hace poco no se vuelve a pedir (freno)
 *   3. una posición vieja se pide, se calcula la distancia y se guarda
 *   4. el simulacro no consulta
 *   5. si el proveedor falla se devuelve lo último guardado
 *   6. a la pantalla pública no salen las coordenadas
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const { getStatus, update } = vi.hoisted(() => ({ getStatus: vi.fn(), update: vi.fn() }))

vi.mock("@/lib/courier", () => ({
  getCourierProvider: () => ({ getStatus }),
}))
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      update: (c: unknown) => {
        update(c)
        return { eq: () => ({ then: () => undefined }) }
      },
    }),
  }),
}))

import { refrescarPosicion, riderParaPantalla, FRESCO_MS } from "@/lib/tracker/posicion-en-vivo"

const AHORA = Date.parse("2026-10-28T17:00:00Z")
const fila = (extra: Record<string, unknown> = {}) => ({
  id: "o1",
  status: "RIDER_PICKED_UP" as const,
  delivery_provider_order_id: "p1",
  dropoff_lat: -2.1894,
  dropoff_lng: -79.8891,
  rider_info: null as never,
  ...extra,
})

beforeEach(() => {
  getStatus.mockReset()
  update.mockReset()
  delete process.env.PEDIDOSYA_COURIER_MOCK
})
afterEach(() => {
  delete process.env.PEDIDOSYA_COURIER_MOCK
})

describe("posición del motorizado en vivo", () => {
  it("no consulta si el pedido aún no sale", async () => {
    await refrescarPosicion(fila({ status: "PENDING" }), AHORA)
    expect(getStatus).not.toHaveBeenCalled()
  })

  it("no vuelve a pedir una posición fresca", async () => {
    const guardado = { eta_min: 7, live_at: new Date(AHORA - (FRESCO_MS - 1000)).toISOString() }
    const r = await refrescarPosicion(fila({ rider_info: guardado }), AHORA)
    expect(getStatus).not.toHaveBeenCalled()
    expect(r).toEqual(guardado)
  })

  it("pide la posición vieja, calcula la distancia y la guarda", async () => {
    getStatus.mockResolvedValue({
      etaMinutes: 4,
      riderInfo: { latitude: -2.1850, longitude: -79.8891 },
    })
    const r = await refrescarPosicion(
      fila({ rider_info: { name: "Luis", live_at: new Date(AHORA - 60_000).toISOString() } }),
      AHORA,
    )
    expect(getStatus).toHaveBeenCalledWith("p1")
    expect(r?.eta_min).toBe(4)
    expect(r?.name).toBe("Luis")
    expect(r?.distance_remaining_m).toBeGreaterThan(400)
    expect(r?.distance_remaining_m).toBeLessThan(500)
    expect(r?.total_distance_m).toBeGreaterThanOrEqual(r?.distance_remaining_m as number)
    expect(update).toHaveBeenCalledTimes(1)
  })

  it("en simulacro no consulta", async () => {
    process.env.PEDIDOSYA_COURIER_MOCK = "true"
    await refrescarPosicion(fila(), AHORA)
    expect(getStatus).not.toHaveBeenCalled()
  })

  it("si el proveedor falla devuelve lo último guardado", async () => {
    getStatus.mockRejectedValue(new Error("caído"))
    const guardado = { eta_min: 9, live_at: new Date(AHORA - 60_000).toISOString() }
    const r = await refrescarPosicion(fila({ rider_info: guardado }), AHORA)
    expect(r).toEqual(guardado)
    expect(update).not.toHaveBeenCalled()
  })

  it("a la pantalla pública no salen las coordenadas", () => {
    const r = riderParaPantalla({ latitude: 1, longitude: 2, eta_min: 5, distance_remaining_m: 300 })
    expect(r).toEqual({ eta_min: 5, distance_remaining_m: 300 })
  })
})
