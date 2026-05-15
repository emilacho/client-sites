import { NextResponse } from "next/server"
import { getSupabaseAdmin } from "@/lib/supabase"
import { contactSubmissionSchema } from "@/lib/schemas"
import { cliente } from "@/cliente.config"

export const runtime = "nodejs"

/**
 * Contact form submission handler · canon-strip rev.
 *
 *   1. Validate Zod schema
 *   2. Insert contact_submissions row (Supabase service-role)
 *
 * Email delivery (Resend) and anti-spam (Turnstile) are deliberately NOT
 * wired in this revision · the canon stack for first-launch is Supabase
 * persist only. Retro-fit email + anti-spam post-launch via a separate
 * pickup job that scans `WHERE notification_sent = FALSE`.
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

  return NextResponse.json({
    ok: true,
    submission_id: inserted.id,
    submitted_at: inserted.submitted_at,
  })
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/contact",
    method: "POST",
    runtime: "nodejs",
    description:
      "Contact form submission · Supabase persist only · email + anti-spam deferred to a pickup job.",
    body_shape: {
      name: "string (required, max 120)",
      email: "string (required, valid email)",
      phone: "string (optional)",
      message: "string (required, max 4000)",
    },
  })
}
