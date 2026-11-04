/** R185 · un pedido no se va del tablero de la cocina porque PedidosYa lo pase a READY. */
import { describe, expect, it } from "vitest"
import { sigueEnCocina } from "@/lib/cocina-motorizado"

describe("R185 · sigueEnCocina", () => {
  it("READY sin hora de listo (lo puso PedidosYa) sigue en el tablero", () => {
    expect(sigueEnCocina("READY", null)).toBe(true)
    expect(sigueEnCocina("READY", undefined)).toBe(true)
  })
  it("READY con hora de listo (lo marcó la cocina) se va del tablero", () => {
    expect(sigueEnCocina("READY", "2026-11-04T20:00:00Z")).toBe(false)
  })
  it("los estados de cocina siguen; lo que ya salió o terminó no", () => {
    for (const s of ["PENDING", "ACCEPTED", "PREPARING", "NEEDS_ATTENTION"]) expect(sigueEnCocina(s, null)).toBe(true)
    for (const s of ["RIDER_PICKED_UP", "IN_TRANSIT", "DELIVERED", "CANCELLED", "PENDING_PAYMENT"]) expect(sigueEnCocina(s, null)).toBe(false)
  })
})
