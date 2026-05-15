/**
 * contact-route.test.ts · canon-strip rev
 *
 * Verifies POST /api/contact:
 *   1. valid submission · 200 + Supabase row persisted
 *   2. invalid email · 400 validation
 *   3. missing required field (message) · 400 validation
 *   4. invalid json body · 400
 *   5. Supabase insert error · 500 graceful
 *
 * Email + Turnstile dropped from this rev · pure persist contract.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockInsertSingle = vi.fn()
const mockInsert = vi.fn()

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from() {
      return {
        insert: (...args: unknown[]) => {
          mockInsert(...args)
          return {
            select: () => ({ single: () => mockInsertSingle() }),
          }
        },
      }
    },
  }),
}))

import { POST } from "../app/api/contact/route"

const buildReq = (body: unknown, rawText?: string) =>
  new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: rawText ?? JSON.stringify(body),
  })

const validPayload = {
  name: "Visitante Test",
  email: "visitor@example.com",
  phone: "+593990000000",
  message: "Quisiera más información sobre sus servicios.",
}

beforeEach(() => {
  mockInsert.mockReset()
  mockInsertSingle.mockReset()
  mockInsertSingle.mockResolvedValue({
    data: { id: "submission-uuid-1", submitted_at: "2026-05-15T18:00:00Z" },
    error: null,
  })
})

describe("POST /api/contact · canon-strip (Supabase only)", () => {
  it("happy path · valid submission persists", async () => {
    const res = await POST(buildReq(validPayload))
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      ok: boolean
      submission_id: string
      submitted_at: string
    }
    expect(j.ok).toBe(true)
    expect(j.submission_id).toBe("submission-uuid-1")
    expect(j.submitted_at).toBe("2026-05-15T18:00:00Z")
    expect(mockInsert).toHaveBeenCalledTimes(1)
  })

  it("invalid email · 400 validation error", async () => {
    const res = await POST(
      buildReq({ ...validPayload, email: "not-an-email" }),
    )
    expect(res.status).toBe(400)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("validation_failed")
  })

  it("missing message · 400 validation error", async () => {
    const res = await POST(
      buildReq({ name: "X", email: "x@y.com", message: "" }),
    )
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

  it("Supabase persist error · 500 graceful", async () => {
    mockInsertSingle.mockResolvedValue({
      data: null,
      error: { message: "permission denied for table" },
    })
    const res = await POST(buildReq(validPayload))
    expect(res.status).toBe(500)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("persist_failed")
  })
})
