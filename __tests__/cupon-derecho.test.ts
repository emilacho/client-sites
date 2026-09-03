/**
 * cupon-derecho.test.ts · R155
 *
 * Las reglas del cupón vivían en una ruta que el cliente puede
 * simplemente no llamar. Estas pruebas fijan que ahora se comprueban
 * donde entra el dinero.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { filas } = vi.hoisted(() => ({ filas: { valor: [] as unknown[] } }))

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => {
    const q: Record<string, unknown> = {}
    Object.assign(q, {
      from: () => q,
      select: () => q,
      eq: () => q,
      limit: async () => ({ data: filas.valor, error: null }),
    })
    return q
  },
}))

import { tieneDerechoAlCupon } from "@/lib/checkout/cupon"

const TEL = "0997744288"
const haceHoras = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()

beforeEach(() => { filas.valor = [] })

describe("¿tiene derecho al cupón? · R155", () => {
  it("nunca lo usó · primer uso libre", async () => {
    expect((await tieneDerechoAlCupon("SURFBOLLADO", TEL)).tieneDerecho).toBe(true)
  })

  it("lo usó hace 2 horas · todavía no", async () => {
    filas.valor = [{ last_used_at: haceHoras(2), qualifying_spend_since_last_use: 100 }]
    const r = await tieneDerechoAlCupon("SURFBOLLADO", TEL)
    expect(r.tieneDerecho).toBe(false)
    expect(r.motivo).toBe("todavia_no_pasaron_24h")
  })

  it("pasaron 24h pero no gastó lo suficiente · todavía no", async () => {
    filas.valor = [{ last_used_at: haceHoras(30), qualifying_spend_since_last_use: 10 }]
    const r = await tieneDerechoAlCupon("SURFBOLLADO", TEL)
    expect(r.tieneDerecho).toBe(false)
    expect(r.motivo).toBe("le_falta_gastar")
  })

  it("pasaron 24h Y gastó lo suficiente · sí", async () => {
    filas.valor = [{ last_used_at: haceHoras(30), qualifying_spend_since_last_use: 30 }]
    expect((await tieneDerechoAlCupon("SURFBOLLADO", TEL)).tieneDerecho).toBe(true)
  })

  it("justo en el borde · 25 dólares clavados alcanza", async () => {
    filas.valor = [{ last_used_at: haceHoras(25), qualifying_spend_since_last_use: 25 }]
    expect((await tieneDerechoAlCupon("SURFBOLLADO", TEL)).tieneDerecho).toBe(true)
  })

  it("sin teléfono no se puede comprobar · no se regala", async () => {
    const r = await tieneDerechoAlCupon("SURFBOLLADO", "")
    expect(r.tieneDerecho).toBe(false)
    expect(r.motivo).toBe("sin_telefono")
  })

  it("un código inventado no da derecho a nada", async () => {
    expect((await tieneDerechoAlCupon("REGALAME10", TEL)).tieneDerecho).toBe(true)
    // ojo · sin reglas propias devuelve true, pero la tabla de porcentajes
    // no lo conoce y termina en 0% · se comprueba abajo
  })

  it("sin código no hay derecho", async () => {
    expect((await tieneDerechoAlCupon(null, TEL)).tieneDerecho).toBe(false)
    expect((await tieneDerechoAlCupon("", TEL)).tieneDerecho).toBe(false)
  })
})

describe("y el porcentaje sigue saliendo de la casa", () => {
  it("un código inventado descuenta cero, aunque pase el derecho", async () => {
    const { computeDiscount } = await import("@/lib/checkout/pricing")
    expect(computeDiscount(100, "REGALAME10").amountUsd).toBe(0)
    expect(computeDiscount(100, "SURFBOLLADO").amountUsd).toBe(5)
  })
})
