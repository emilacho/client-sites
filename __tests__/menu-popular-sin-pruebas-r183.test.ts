/** R183 · lo «más pedido» que ve el cliente no cuenta los pedidos de prueba. */
import { afterEach, describe, expect, it, vi } from "vitest"

const filas = [
  { cart_lines: [{ id: "ceviche-naufrago", qty: 1 }], status: "DELIVERED", es_prueba: false },
  { cart_lines: [{ id: "encebollado-naufrago", qty: 50 }], status: "DELIVERED", es_prueba: true },
]

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => {
    let r = [...filas] as Array<Record<string, unknown>>
    const q = {
      select: () => q,
      gte: () => q,
      neq: (c: string, v: unknown) => { r = r.filter((x) => x[c] !== v); return q },
      eq: (c: string, v: unknown) => { r = r.filter((x) => x[c] === v); return q },
      limit: () => Promise.resolve({ data: r, error: null }),
    }
    return { from: () => q }
  },
}))
afterEach(() => vi.restoreAllMocks())

describe("R183 · /api/menu/popular", () => {
  it("una prueba de 50 unidades no suma: el plato vendido de verdad va primero y el de prueba queda en 0", async () => {
    const { GET } = await import("@/app/api/menu/popular/route")
    const { items } = await (await GET()).json() as { items: Array<{ id: string; totalQty: number }> }
    expect(items[0]).toMatchObject({ id: "ceviche-naufrago", totalQty: 1 })
    const prueba = items.find((i) => i.id === "encebollado-naufrago")
    if (prueba) expect(prueba.totalQty).toBe(0)
  })
})
