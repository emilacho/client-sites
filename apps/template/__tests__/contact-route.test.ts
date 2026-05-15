/**
 * contact-route.test.ts · template app
 *
 * Verifies POST /api/contact:
 *   1. valid submission · 200 + persisted + emails fired
 *   2. invalid email · 400 validation
 *   3. Turnstile fail · 403
 *   4. Supabase insert error · 500 graceful
 *   5. Resend failure · 200 (submission already persisted · partial-fail tracked)
 *
 * Pure mocked · no live network.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

const mockInsertSingle = vi.fn()
const mockUpdate = vi.fn()
const mockEq = vi.fn()
const mockSelect = vi.fn()
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
        update: (...args: unknown[]) => {
          mockUpdate(...args)
          return {
            eq: (...e: unknown[]) => {
              mockEq(...e)
              return Promise.resolve({ data: null, error: null })
            },
          }
        },
        select: () => ({ single: () => mockSelect() }),
      }
    },
  }),
}))

const mockVerifyTurnstile = vi.fn()
vi.mock("@/lib/turnstile", () => ({
  verifyTurnstile: (...args: unknown[]) => mockVerifyTurnstile(...args),
}))

const mockSendContactEmails = vi.fn()
vi.mock("@client-sites/email", () => ({
  sendContactEmails: (...args: unknown[]) => mockSendContactEmails(...args),
}))

import { POST } from "../app/api/contact/route"

const buildReq = (body: unknown) =>
  new Request("http://localhost:3000/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

const validPayload = {
  name: "Visitante Test",
  email: "visitor@example.com",
  phone: "+593990000000",
  message: "Quisiera más información sobre sus servicios.",
  turnstile_token: "test-token-1234567890",
}

beforeEach(() => {
  mockInsert.mockReset()
  mockInsertSingle.mockReset()
  mockUpdate.mockReset()
  mockEq.mockReset()
  mockSelect.mockReset()
  mockVerifyTurnstile.mockReset()
  mockSendContactEmails.mockReset()

  // Default · Turnstile skipped because env var absent in tests
  delete process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY

  // Default · Supabase insert succeeds
  mockInsertSingle.mockResolvedValue({
    data: { id: "submission-uuid-1", submitted_at: "2026-05-15T17:00:00Z" },
    error: null,
  })
  // Default · Resend both ok
  mockSendContactEmails.mockResolvedValue({
    notification: { ok: true, messageId: "resend-notify-1" },
    confirmation: { ok: true, messageId: "resend-confirm-1" },
  })
})

describe("POST /api/contact", () => {
  it("happy path · valid submission persists + fires both emails", async () => {
    const res = await POST(buildReq(validPayload))
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      ok: boolean
      submission_id: string
      notification_sent: boolean
      confirmation_sent: boolean
    }
    expect(j.ok).toBe(true)
    expect(j.submission_id).toBe("submission-uuid-1")
    expect(j.notification_sent).toBe(true)
    expect(j.confirmation_sent).toBe(true)
    expect(mockSendContactEmails).toHaveBeenCalledTimes(1)
  })

  it("invalid email · 400 validation error", async () => {
    const res = await POST(
      buildReq({ ...validPayload, email: "not-an-email" }),
    )
    expect(res.status).toBe(400)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("validation_failed")
  })

  it("Turnstile fail · 403 when secret configured and token invalid", async () => {
    process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY = "test-secret"
    mockVerifyTurnstile.mockResolvedValue({
      valid: false,
      reason: "invalid-input-response",
    })
    const res = await POST(buildReq(validPayload))
    expect(res.status).toBe(403)
    const j = (await res.json()) as { error: string }
    expect(j.error).toBe("turnstile_failed")
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

  it("Resend partial failure · 200 with confirmation_sent false (row already persisted)", async () => {
    mockSendContactEmails.mockResolvedValue({
      notification: { ok: true, messageId: "n1" },
      confirmation: { ok: false, error: "rate_limited" },
    })
    const res = await POST(buildReq(validPayload))
    expect(res.status).toBe(200)
    const j = (await res.json()) as {
      ok: boolean
      notification_sent: boolean
      confirmation_sent: boolean
    }
    expect(j.ok).toBe(true)
    expect(j.notification_sent).toBe(true)
    expect(j.confirmation_sent).toBe(false)
  })
})
