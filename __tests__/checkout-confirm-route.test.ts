/**
 * checkout-confirm-route.test.ts · Round 98
 *
 * Verifies POST /api/checkout/confirm:
 *   1. happy path · creates order row + ORDER_CREATED audit · 200 with code + redirect_url
 *   2. discount NAUFRAGO5 applies 5% off subtotal
 *   3. invalid dropoff (empty street) · 400
 *   4. invalid payment method · 400
 *   5. Supabase insert error · 500 graceful
 *   6. invalid json body · 400
 *   7. audit event insert failure · 200 with audit_warning
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const orderInsertSingle = vi.fn()
const orderInsert = vi.fn()
const eventInsert = vi.fn()

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from(table: string) {
      if (table === "naufrago_orders") {
        return {
          insert: (...args: unknown[]) => {
            orderInsert(...args)
            return {
              select: () => ({ single: () => orderInsertSingle() }),
            }
          },
        }
      }
      if (table === "naufrago_order_events") {
        return {
          insert: (...args: unknown[]) => {
            return Promise.resolve(eventInsert(...args))
          },
        }
      }
      throw new Error(`unmocked table: ${table}`)
    },
  }),
}))

import { POST } from "../app/api/checkout/confirm/route"

const buildReq = (body: unknown, rawText?: string) =>
  new Request("http://localhost:3000/api/checkout/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawText ?? JSON.stringify(body),
  })

const validBody = {
  dropoff: {
    street: "Calle Principal 123, Olón",
    detail: "Casa azul frente al mar",
    countryCode: "EC",
    latitude: -1.8045,
    longitude: -80.7547,
  },
  lines: [
    { id: "encebollado", name: "Encebollado Náufrago", priceUsd: 6.5, qty: 2 },
    { id: "ceviche", name: "Ceviche de Camarón", priceUsd: 8.0, qty: 1 },
  ],
  customer: {
    name: "Cliente Test",
    phone: "+593990000000",
    email: "test@example.com",
  },
  deliveryProvider: "PEDIDOSYA_COURIER",
  deliveryQuoteToken: "EST-abc-123",
  customerNotes: "Pitar dos veces",
  subtotalUsd: 21,
  paymentMethod: "CASH_ON_DELIVERY",
}

beforeEach(() => {
  orderInsert.mockReset()
  orderInsertSingle.mockReset()
  eventInsert.mockReset()
  orderInsertSingle.mockResolvedValue({
    data: {
      id: "order-uuid-1",
      order_code: "NF-2026-AB12CD",
      created_at: "2026-05-19T19:00:00Z",
    },
    error: null,
  })
  eventInsert.mockReturnValue({ data: null, error: null })
})

describe("POST /api/checkout/confirm · R98", () => {
  it("happy path · creates order + returns code + redirect_url", async () => {
    const res = await POST(buildReq(validBody))
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      ok: boolean
      order_id: string
      order_code: string
      status: string
      payment_status: string
      subtotal_usd: number
      total_usd: number
      redirect_url: string
    }
    expect(j.ok).toBe(true)
    expect(j.order_id).toBe("order-uuid-1")
    expect(j.order_code).toBe("NF-2026-AB12CD")
    expect(j.status).toBe("PENDING")
    expect(j.payment_status).toBe("PENDING")
    expect(j.subtotal_usd).toBe(21)
    expect(j.total_usd).toBe(21)
    expect(j.redirect_url).toBe("/order/NF-2026-AB12CD")
    expect(orderInsert).toHaveBeenCalledTimes(1)
    expect(eventInsert).toHaveBeenCalledTimes(1)
    const insertedRow = orderInsert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertedRow.order_code).toMatch(/^NF-\d{4}-[A-F0-9]{6}$/)
    expect(insertedRow.customer_name).toBe("Cliente Test")
    expect(insertedRow.delivery_provider).toBe("PEDIDOSYA_COURIER")
    expect(insertedRow.payment_method).toBe("CASH_ON_DELIVERY")
    expect(insertedRow.status).toBe("PENDING")
  })

  it("discount NAUFRAGO5 · 5% off subtotal applied server-side", async () => {
    const res = await POST(
      buildReq({ ...validBody, discountCode: "NAUFRAGO5" }),
    )
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      subtotal_usd: number
      discount_usd: number
      total_usd: number
    }
    expect(j.subtotal_usd).toBe(21)
    expect(j.discount_usd).toBe(1.05) // 5% of 21
    expect(j.total_usd).toBe(19.95) // 21 - 1.05
    const insertedRow = orderInsert.mock.calls[0]?.[0] as Record<string, unknown>
    expect(insertedRow.discount_code).toBe("NAUFRAGO5")
    expect(insertedRow.discount_usd).toBe(1.05)
  })

  it("unknown discount code · resolves to 0 discount", async () => {
    const res = await POST(
      buildReq({ ...validBody, discountCode: "INVALIDCODE" }),
    )
    expect(res.status).toBe(200)
    const j = (await res.json()) as { discount_usd: number; total_usd: number }
    expect(j.discount_usd).toBe(0)
    expect(j.total_usd).toBe(21)
  })

  it("invalid dropoff · empty street · 400 validation", async () => {
    const res = await POST(
      buildReq({ ...validBody, dropoff: { ...validBody.dropoff, street: "" } }),
    )
    expect(res.status).toBe(400)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("validation_failed")
    expect(orderInsert).not.toHaveBeenCalled()
  })

  it("invalid payment method · 400 validation", async () => {
    const res = await POST(
      buildReq({ ...validBody, paymentMethod: "BITCOIN" }),
    )
    expect(res.status).toBe(400)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("validation_failed")
  })

  it("Supabase insert error · 500 graceful", async () => {
    orderInsertSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied for table" },
    })
    const res = await POST(buildReq(validBody))
    expect(res.status).toBe(500)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("persist_failed")
  })

  it("audit event insert fails · order still succeeds with audit_warning", async () => {
    eventInsert.mockReturnValue({ data: null, error: { message: "event table read-only" } })
    const res = await POST(buildReq(validBody))
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      ok: boolean
      audit_warning: string | null
    }
    expect(j.ok).toBe(true)
    expect(j.audit_warning).toBe("event table read-only")
  })

  it("invalid json body · 400", async () => {
    const res = await POST(buildReq(null, "{not valid json"))
    expect(res.status).toBe(400)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("invalid_json")
  })
})
