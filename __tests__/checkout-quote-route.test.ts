/**
 * checkout-quote-route.test.ts · Round 98
 *
 * Verifies POST /api/checkout/quote:
 *   1. happy path · real provider quote · 200 + delivery_options[]
 *   2. stub fallback · provider throws CourierEnvError · 200 + stub:true
 *   3. invalid dropoff (empty street) · 400 validation
 *   4. invalid json body · 400
 *   5. empty cart lines · 400 validation
 *   6. provider shape error (502-class · we surface as error on the option) · 200 with error message
 */
// R154 · los platos de estas pruebas ahora son los REALES de la carta.
// Antes eran inventados ("encebollado" a $6.50) y pasaban porque el
// servidor aceptaba cualquier precio que le mandaran · justo el agujero
// que R154 cierra. Con platos de mentira, estas pruebas no probaban nada.
import { describe, it, expect, vi, beforeEach } from "vitest"

// Hoisted so the `vi.mock` factory below (which itself is hoisted)
// can capture them before module top-level code runs.
const { mockGetQuote, fakeProvider } = vi.hoisted(() => {
  const mockGetQuote = vi.fn()
  const fakeProvider = {
    id: "PEDIDOSYA_COURIER" as const,
    label: "PedidosYa Courier (EC)",
    getQuote: (...args: unknown[]) => mockGetQuote(...args),
    dispatch: vi.fn(),
    getStatus: vi.fn(),
    cancel: vi.fn(),
    verifyWebhookSignature: vi.fn(),
    parseWebhookEvent: vi.fn(),
  }
  return { mockGetQuote, fakeProvider }
})

vi.mock("@/lib/courier", async () => {
  const actual = await vi.importActual<typeof import("@/lib/courier")>(
    "@/lib/courier",
  )
  return {
    ...actual,
    getActiveCourierProviders: () => [fakeProvider],
  }
})

import { POST } from "../app/api/checkout/quote/route"
import { CourierEnvError } from "@/lib/courier/provider"

const buildReq = (body: unknown, rawText?: string) =>
  new Request("http://localhost:3000/api/checkout/quote", {
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
    { id: "encebollado-naufrago", name: "Encebollado Náufrago", priceUsd: 4, qty: 2 },
    { id: "ceviche-naufrago", name: "Ceviche Náufrago", priceUsd: 7, qty: 1 },
  ],
}

beforeEach(() => {
  mockGetQuote.mockReset()
})

describe("POST /api/checkout/quote · R98", () => {
  it("happy path · real provider quote · 200 + delivery_options", async () => {
    mockGetQuote.mockResolvedValue({
      quoteToken: "EST-abc-123",
      priceUsd: 2.75,
      etaMinutes: 22,
      expiresAt: "2026-05-19T20:30:00.000Z",
      raw: {},
    })
    const res = await POST(buildReq(validBody))
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      ok: boolean
      subtotal_usd: number
      item_count: number
      delivery_options: Array<{
        provider_id: string
        quote_token: string
        fee_usd: number
        eta_minutes: number
        stub: boolean
      }>
      payment_methods: string[]
    }
    expect(j.ok).toBe(true)
    expect(j.subtotal_usd).toBe(15) // 6.5*2 + 8.0
    expect(j.item_count).toBe(3)
    expect(j.delivery_options).toHaveLength(1)
    expect(j.delivery_options[0].provider_id).toBe("PEDIDOSYA_COURIER")
    expect(j.delivery_options[0].quote_token).toBe("EST-abc-123")
    expect(j.delivery_options[0].fee_usd).toBe(2.75)
    expect(j.delivery_options[0].stub).toBe(false)
    // offline fallback payment methods always present
    expect(j.payment_methods).toContain("CASH_ON_DELIVERY")
    expect(j.payment_methods).toContain("WHATSAPP_MANUAL")
  })

  it("stub fallback · CourierEnvError → stub:true quote returned", async () => {
    mockGetQuote.mockRejectedValue(
      new CourierEnvError("PEDIDOSYA_COURIER_CLIENT_ID"),
    )
    const res = await POST(buildReq(validBody))
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      delivery_options: Array<{
        provider_id: string
        quote_token: string
        fee_usd: number
        stub: boolean
        provider_label: string
      }>
    }
    expect(j.delivery_options).toHaveLength(1)
    expect(j.delivery_options[0].stub).toBe(true)
    expect(j.delivery_options[0].quote_token).toMatch(
      /^STUB-PEDIDOSYA_COURIER-[A-F0-9]{8}$/,
    )
    expect(j.delivery_options[0].fee_usd).toBe(2.5)
    expect(j.delivery_options[0].provider_label).toContain("stub")
  })

  it("provider shape error · surfaces error string on the option · 200", async () => {
    mockGetQuote.mockRejectedValue(new Error("quote_502:upstream_down"))
    const res = await POST(buildReq(validBody))
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      delivery_options: Array<{ error?: string; stub: boolean }>
    }
    expect(j.delivery_options[0].error).toBe("quote_502:upstream_down")
    expect(j.delivery_options[0].stub).toBe(false)
  })

  it("invalid dropoff · empty street · 400 validation", async () => {
    const res = await POST(
      buildReq({ ...validBody, dropoff: { ...validBody.dropoff, street: "" } }),
    )
    expect(res.status).toBe(400)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("validation_failed")
  })

  it("empty cart lines · 400 validation", async () => {
    const res = await POST(buildReq({ ...validBody, lines: [] }))
    expect(res.status).toBe(400)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("validation_failed")
  })

  it("invalid json body · 400", async () => {
    const res = await POST(buildReq(null, "{not valid json"))
    expect(res.status).toBe(400)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("invalid_json")
  })
})
