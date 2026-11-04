/** R187 + R188 · el aviso de entrega ejecutado: guarda la hora una sola vez y se la pasa a la venta; tiene el tiempo máximo del plan. */
/* eslint-disable @typescript-eslint/no-explicit-any -- filas de una base falsa */
import { beforeEach, describe, expect, it, vi } from "vitest"

const { st, venta } = vi.hoisted(() => ({
  st: { pedido: null as any, updates: [] as any[], columnas: "" },
  venta: vi.fn(async () => ({ ok: true, receiptNumber: "1" })),
}))

vi.mock("@/lib/courier/para-rutas", () => ({
  verifyWebhookSignature: () => true,
  parseWebhookEvent: () => ({ orderId: "env1", status: "COMPLETED", mappedStatus: st.pedido.__estado, timestamp: "2026-11-05T12:00:00Z", raw: {}, payload: {} }),
}))
vi.mock("@/lib/push-server", () => ({ buildStagePayload: () => null, sendPushForOrder: vi.fn(async () => {}) }))
vi.mock("@/lib/loyalty-server", () => ({ earnPerlas: vi.fn(async () => {}) }))
vi.mock("@/lib/loyverse", () => ({ enviarVentaALoyverse: venta }))
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: (tabla: string) => {
      const q: any = {
        select: (c: string) => { if (tabla === "orders") st.columnas = c; return q },
        eq: () => q, order: () => q, limit: () => q,
        maybeSingle: async () => ({ data: tabla === "orders" ? st.pedido : null, error: null }),
        update: (c: any) => { if (tabla === "orders") st.updates.push(c); return { eq: async () => ({ error: null }) } },
        upsert: () => { const p: any = Promise.resolve({ error: null }); p.throwOnError = () => p; return p },
        insert: () => { const p: any = Promise.resolve({ error: null }); p.throwOnError = () => p; return p },
      }
      return q
    },
  }),
}))
vi.stubGlobal("fetch", vi.fn(async () => new Response("{}")))

const aviso = () => new Request("http://x/api/courier/webhook", { method: "POST", headers: { authorization: "k" }, body: "{}" })
const pedido = (estado: string, delivered_at: string | null) => ({ __estado: estado, id: "o1", order_code: "NF-1", status: "RIDER_PICKED_UP", customer_phone: null, total_usd: 1, delivery_fee_usd: 0, cart_lines: [], customer_notes: null, delivered_at })

describe("R187 + R188 · aviso de entrega", () => {
  beforeEach(() => { st.updates.length = 0; venta.mockClear() })
  it("al entregar guarda la hora, la pide a la base y se la pasa a la venta", async () => {
    st.pedido = pedido("DELIVERED", null)
    const { POST } = await import("@/app/api/courier/webhook/route")
    expect((await POST(aviso())).status).toBeLessThan(300)
    expect(st.columnas).toContain("delivered_at")
    const hora = st.updates[0].delivered_at
    expect(typeof hora).toBe("string")
    expect((venta.mock.calls[0] as any[])[1].entregadoEn).toBe(hora)
  })
  it("un aviso repetido no mueve la hora", async () => {
    st.pedido = pedido("DELIVERED", "2026-11-05T11:00:00Z")
    const { POST } = await import("@/app/api/courier/webhook/route")
    await POST(aviso())
    expect(st.updates[0].delivered_at).toBe("2026-11-05T11:00:00Z")
  })
  it("otros estados no escriben hora de entrega", async () => {
    st.pedido = pedido("IN_TRANSIT", null)
    const { POST } = await import("@/app/api/courier/webhook/route")
    await POST(aviso())
    expect(st.updates[0]).not.toHaveProperty("delivered_at")
    expect(venta).not.toHaveBeenCalled()
  })
  it("tiene el tiempo máximo del plan", async () => {
    const { maxDuration } = await import("@/app/api/courier/webhook/route")
    expect(maxDuration).toBe(800)
  })
})
