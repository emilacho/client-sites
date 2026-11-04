/** R176 · la cocina ve dónde va el motorizado: cada aviso de PedidosYa se traduce a una frase con los minutos que faltan. */
import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { motorizadoParaCocina } from "@/lib/cocina-motorizado"

const AHORA = Date.parse("2026-11-04T18:50:00Z")
const retiro = "2026-11-04T18:58:00Z" // en 8 min

describe("R176 · el motorizado en la pantalla de cocina", () => {
  it("antes de recoger, los minutos son los que faltan para que llegue al local", () => {
    expect(motorizadoParaCocina("CONFIRMED", retiro, null, AHORA)).toMatchObject({ fase: "buscando", minutos: 8, metros: null })
    expect(motorizadoParaCocina("IN_PROGRESS", retiro, null, AHORA)).toMatchObject({ fase: "va_al_local", minutos: 8 })
    expect(motorizadoParaCocina("NEAR_PICKUP", retiro, null, AHORA)).toMatchObject({ fase: "en_el_local" })
    expect(motorizadoParaCocina("NEAR_PICKUP", retiro, null, AHORA).texto).toContain("ten el pedido listo")
  })
  it("ya con el pedido, los minutos y los metros son los que faltan para el cliente", () => {
    expect(motorizadoParaCocina("PICKED_UP", retiro, { eta_min: 12.4, distance_remaining_m: 3180.6 }, AHORA)).toEqual({ fase: "en_camino", texto: "Ya salió con el pedido", minutos: 12, metros: 3181 })
    expect(motorizadoParaCocina("NEAR_DROPOFF", null, { eta_min: 1, distance_remaining_m: 90 }, AHORA)).toMatchObject({ fase: "llegando", minutos: 1, metros: 90 })
    expect(motorizadoParaCocina("COMPLETED", null, null, AHORA).fase).toBe("entregado")
  })
  it("sin aviso del proveedor o con datos raros no inventa nada ni rompe", () => {
    expect(motorizadoParaCocina(undefined, undefined, null, AHORA)).toMatchObject({ fase: "buscando", minutos: null, metros: null })
    expect(motorizadoParaCocina("PICKED_UP", null, { eta_min: "x", distance_remaining_m: NaN }, AHORA)).toMatchObject({ minutos: null, metros: null })
    expect(motorizadoParaCocina("IN_PROGRESS", "2020-01-01T00:00:00Z", null, AHORA).minutos).toBe(0) // un retiro ya pasado no da negativo
  })
  it("la ruta de cocina lo devuelve por pedido y la pantalla lo muestra", () => {
    const r = readFileSync("app/api/cocina/pedidos/route.ts", "utf8")
    expect(r).toContain("motorizado: motorizados.get(p.id) ?? null")
    expect(r).toContain("refrescarPosicion(")
    const c = readFileSync("app/cocina/page.tsx", "utf8")
    expect(c).toContain("data-motorizados")
    expect(c).toContain('p.status !== "DELIVERED" && p.status !== "CANCELLED"')
  })
})
