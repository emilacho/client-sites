/** R186 · las rutas de cocina ejecutadas: el tablero y el toque de listo distinguen el READY de PedidosYa del de la cocina. Base: prueba de CC6 en la certificación de R185. */
/* eslint-disable @typescript-eslint/no-explicit-any -- filas de una base falsa */
import { beforeEach, describe, expect, it, vi } from "vitest"
const { st } = vi.hoisted(() => ({ st: { filas: [] as any[], pedido: null as any, ups: [] as any[], selects: [] as string[] } }))
vi.mock("@/lib/cocina-llave", () => ({ cocinaAutorizada: async () => true }))
vi.mock("@/lib/loyverse", () => ({ enviarVentaALoyverse: vi.fn() }))
vi.mock("@/lib/courier/para-rutas", () => ({ cancelarEnvio: vi.fn() }))
vi.mock("@/lib/loyalty-server", () => ({ devolverPerlasDelPedido: vi.fn() }))
vi.mock("@/lib/tracker/posicion-en-vivo", () => ({ refrescarPosicion: async () => null }))
vi.mock("@/lib/supabase", () => ({ getSupabaseAdmin: () => ({ from: (t: string) => {
  const q: any = { select: (c: string) => { st.selects.push(t + ":" + c); return q }, eq: () => q, neq: () => q, gte: () => q, in: () => q, order: () => q,
    limit: () => Promise.resolve({ data: t === "orders" ? st.filas : [], error: null }),
    maybeSingle: async () => ({ data: st.pedido, error: null }),
    update: (c: any) => { st.ups.push(c); return { eq: async () => ({ error: null }) } },
    insert: () => ({ then: () => undefined }) }
  return q } }) }))
beforeEach(() => { st.ups.length = 0; st.selects.length = 0 })
const fila = (order_code: string, status: string, ready_at: string | null) => ({ id: order_code, order_code, status, ready_at, created_at: "2026-11-04T20:00:00Z", cart_lines: [], delivery_provider_order_id: null })
const req = (u: string, b?: object) => new Request("http://x" + u, { method: b ? "POST" : "GET", headers: { "x-cocina-llave": "k" }, body: b ? JSON.stringify(b) : undefined }) as any
describe("GET /api/cocina/pedidos ejecutada", () => {
  it("vivo por estado y hora", async () => {
    st.filas = [fila("READY-sin", "READY", null), fila("READY-con", "READY", "2026-11-04T20:10:00Z"), fila("PREP", "PREPARING", null), fila("PICK", "RIDER_PICKED_UP", null), fila("ENTR", "DELIVERED", null), fila("CANC", "CANCELLED", null), fila("ATN", "NEEDS_ATTENTION", null)]
    const { GET } = await import("@/app/api/cocina/pedidos/route")
    const j = await (await GET(req("/api/cocina/pedidos"))).json()
    const v = Object.fromEntries(j.pedidos.map((p: any) => [p.order_code, p.vivo]))
    expect(v).toEqual({ "READY-sin": true, "READY-con": false, PREP: true, PICK: false, ENTR: false, CANC: false, ATN: true })
    expect(st.selects.find((s) => s.startsWith("orders:"))).toContain("ready_at")
  })
})
describe("POST /api/cocina/avanzar ejecutada", () => {
  const casos: Array<[string, string, string | null, number]> = [
    ["listo", "READY", null, 200], ["listo", "READY", "2026-11-04T20:10:00Z", 409],
    ["aceptar", "READY", null, 409], ["preparar", "READY", null, 409],
    ["listo", "RIDER_PICKED_UP", null, 409], ["listo", "IN_TRANSIT", null, 409], ["listo", "DELIVERED", null, 409], ["listo", "PREPARING", null, 200],
  ]
  for (const [paso, status, ready_at, esperado] of casos) it(`${paso} sobre ${status} ready_at=${ready_at}`, async () => {
    st.pedido = { ...fila("X", status, ready_at), total_usd: 1 }
    const { POST } = await import("@/app/api/cocina/avanzar/route")
    const r = await POST(req("/api/cocina/avanzar", { orderId: "X", paso }))
    expect(r.status).toBe(esperado); expect(st.ups.length).toBe(esperado === 200 ? 1 : 0)
    expect(st.selects.find((s) => s.startsWith("orders:"))).toContain("ready_at")
    if (esperado === 200) expect(st.ups[0]).toMatchObject({ status: "READY", ready_at: expect.any(String) })
  })
})
