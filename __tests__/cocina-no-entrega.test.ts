/**
 * cocina-no-entrega.test.ts · 28-oct
 *
 * La cocina anuncia "listo"; la ENTREGA la confirma el motorizado por
 * PedidosYa. Antes un toque en "Cobrado" marcaba el pedido como entregado
 * sin que saliera ninguna moto.
 *
 *   1. entregado sobre un pedido READY · 409 y no escribe nada
 *   2. entregado sobre un pedido PENDING · 409 y no escribe nada
 *   3. listo sobre un pedido ya READY · 409 (los pasos sólo van adelante)
 *   4. listo sobre un pedido PENDING · 200 y escribe READY
 *   5. entregado sobre un pedido YA entregado · reintenta la contabilidad
 *      sin tocar estado ni hora
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const { estado, update, insert, venta } = vi.hoisted(() => ({
  estado: { pedido: null as Record<string, unknown> | null },
  update: vi.fn(),
  insert: vi.fn(),
  venta: vi.fn(),
}))

vi.mock("@/lib/cocina-llave", () => ({ cocinaAutorizada: async () => true }))
vi.mock("@/lib/loyverse", () => ({ enviarVentaALoyverse: venta }))
vi.mock("@/lib/courier/para-rutas", () => ({ cancelarEnvio: vi.fn() }))
vi.mock("@/lib/loyalty-server", () => ({ devolverPerlasDelPedido: vi.fn() }))
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: (tabla: string) => {
      if (tabla === "order_events") {
        return { insert: (...a: unknown[]) => ({ then: () => insert(...a) }) }
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: estado.pedido, error: null }) }),
        }),
        update: (c: unknown) => {
          update(c)
          return { eq: async () => ({ error: null }) }
        },
      }
    },
  }),
}))

import { POST } from "@/app/api/cocina/avanzar/route"

function pedir(paso: string) {
  return POST(
    new Request("http://x/api/cocina/avanzar", {
      method: "POST",
      body: JSON.stringify({ orderId: "o1", paso }),
    }) as never,
  )
}

function pedido(status: string, extra: Record<string, unknown> = {}) {
  return {
    id: "o1",
    order_code: "NF-2026-AAAAAA",
    status,
    cart_lines: [],
    delivery_fee_usd: 3.3,
    total_usd: 7.3,
    customer_notes: null,
    delivered_at: null,
    delivery_provider_order_id: "p1",
    ...extra,
  }
}

beforeEach(() => {
  update.mockClear()
  insert.mockClear()
  venta.mockReset()
  venta.mockResolvedValue({ ok: true, receiptNumber: "1" })
})

describe("la cocina no marca entregado", () => {
  it("entregado sobre un pedido READY se rechaza y no escribe", async () => {
    estado.pedido = pedido("READY")
    const r = await pedir("entregado")
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe("lo_marca_el_motorizado")
    expect(update).not.toHaveBeenCalled()
    expect(venta).not.toHaveBeenCalled()
  })

  it("entregado sobre un pedido PENDING se rechaza y no escribe", async () => {
    estado.pedido = pedido("PENDING")
    const r = await pedir("entregado")
    expect(r.status).toBe(409)
    expect(update).not.toHaveBeenCalled()
  })

  it("listo sobre un pedido ya READY se rechaza", async () => {
    estado.pedido = pedido("READY")
    const r = await pedir("listo")
    expect(r.status).toBe(409)
    expect((await r.json()).error).toBe("paso_ya_dado")
    expect(update).not.toHaveBeenCalled()
  })

  it("listo sobre un pedido PENDING escribe READY", async () => {
    estado.pedido = pedido("PENDING")
    const r = await pedir("listo")
    expect(r.status).toBe(200)
    expect(update).toHaveBeenCalledTimes(1)
    expect(update.mock.calls[0][0]).toMatchObject({ status: "READY" })
  })

  it("entregado sobre un pedido ya entregado sólo reintenta la contabilidad", async () => {
    estado.pedido = pedido("DELIVERED", { delivered_at: "2026-10-28T16:00:00Z" })
    const r = await pedir("entregado")
    expect(r.status).toBe(200)
    expect(update).not.toHaveBeenCalled()
    expect(venta).toHaveBeenCalledTimes(1)
    expect(venta.mock.calls[0][1]).toMatchObject({ entregadoEn: "2026-10-28T16:00:00Z" })
  })
})
