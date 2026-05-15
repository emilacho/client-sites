import { NextResponse } from "next/server"
import { sendContactEmails } from "@client-sites/email"
import { getSupabaseAdmin } from "@/lib/supabase"
import { verifyTurnstile } from "@/lib/turnstile"
import { contactSubmissionSchema } from "@/lib/schemas"
import { cliente } from "@/cliente.config"

export const runtime = "nodejs"

/**
 * Contact form submission handler.
 *
 *   1. Validate Zod schema
 *   2. Verify Cloudflare Turnstile token (anti-spam)
 *   3. Insert contact_submissions row (audit · always lands even if email fails)
 *   4. Fire 2 Resend emails in parallel (client notify + visitor confirm)
 *   5. Patch the row with delivery state so a retry job can pick up partials
 *
 * Skip-Turnstile-when-no-secret behavior: in local dev without a secret key
 * we let the submission through but flag it. Production deploys MUST set
 * CLOUDFLARE_TURNSTILE_SECRET_KEY · without it the form is unprotected.
 */
export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = contactSubmissionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }
  const data = parsed.data

  // ── Turnstile verify (skip-when-no-secret keeps local dev unblocked) ──
  if (process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY) {
    const remoteIp =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined
    const turnstile = await verifyTurnstile(data.turnstile_token ?? "", remoteIp)
    if (!turnstile.valid) {
      return NextResponse.json(
        { error: "turnstile_failed", reason: turnstile.reason },
        { status: 403 },
      )
    }
  }

  // ── Persist FIRST · so a Resend outage doesn't lose the lead ──
  const supabase = getSupabaseAdmin()
  const ipAddress =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
  const userAgent = request.headers.get("user-agent") ?? null

  const { data: inserted, error: insertErr } = await supabase
    .from("contact_submissions")
    .insert({
      client_slug: cliente.slug,
      name: data.name,
      email: data.email,
      phone: data.phone || null,
      message: data.message,
      turnstile_token: data.turnstile_token ?? null,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .select("id, submitted_at")
    .single()

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: "persist_failed", detail: insertErr?.message },
      { status: 500 },
    )
  }

  // ── Fire emails (best-effort, partial failures tracked on the row) ──
  const result = await sendContactEmails({
    clientName: cliente.name,
    clientSlug: cliente.slug,
    contactEmailTo: cliente.contactEmailTo,
    fromEmail: cliente.fromEmail,
    submitterName: data.name,
    submitterEmail: data.email,
    submitterPhone: data.phone || undefined,
    message: data.message,
    submittedAt: inserted.submitted_at,
  })

  // Patch delivery state for observability + retry jobs.
  await supabase
    .from("contact_submissions")
    .update({
      notification_sent: result.notification.ok,
      email_sent: result.confirmation.ok,
      resend_message_id:
        result.notification.messageId ?? result.confirmation.messageId ?? null,
    })
    .eq("id", inserted.id)

  return NextResponse.json({
    ok: true,
    submission_id: inserted.id,
    notification_sent: result.notification.ok,
    confirmation_sent: result.confirmation.ok,
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/contact",
    method: "POST",
    runtime: "nodejs",
    description:
      "Contact form submission handler. Validates, Turnstile-verifies, persists to contact_submissions, fires Resend notification + confirmation.",
    body_shape: {
      name: "string (required, max 120)",
      email: "string (required, valid email)",
      phone: "string (optional)",
      message: "string (required, max 4000)",
      turnstile_token: "string (required in prod, optional in local dev)",
    },
  })
}
