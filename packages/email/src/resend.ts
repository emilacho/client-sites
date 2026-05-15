import { Resend } from "resend"
import { ContactFormSubmission } from "./templates/ContactFormSubmission"
import { ContactConfirmation } from "./templates/ContactConfirmation"

export interface ContactSubmissionPayload {
  clientName: string
  clientSlug: string
  contactEmailTo: string
  fromEmail: string
  submitterName: string
  submitterEmail: string
  submitterPhone?: string
  message: string
  submittedAt: string
}

export interface SendContactResult {
  notification: { ok: boolean; messageId?: string; error?: string }
  confirmation: { ok: boolean; messageId?: string; error?: string }
}

/**
 * Send the two-email handshake for a contact form submission.
 *
 *   1. Client notification · `clientEmailTo` receives the submission details
 *   2. Visitor confirmation · the submitter gets a "we received it" email
 *
 * Both are best-effort independently · a failure in one does not block the
 * other. The caller is responsible for persisting the result back to the
 * `contact_submissions` row so a retry job can pick up partial failures.
 *
 * Uses a lazy Resend client to keep the package tree-shakable when imported
 * without RESEND_API_KEY set (e.g. unit tests that mock this module).
 */
export async function sendContactEmails(
  payload: ContactSubmissionPayload,
  apiKey: string = process.env.RESEND_API_KEY ?? "",
): Promise<SendContactResult> {
  if (!apiKey) {
    return {
      notification: { ok: false, error: "RESEND_API_KEY not configured" },
      confirmation: { ok: false, error: "RESEND_API_KEY not configured" },
    }
  }

  const resend = new Resend(apiKey)

  const [notify, confirm] = await Promise.allSettled([
    resend.emails.send({
      from: payload.fromEmail,
      to: payload.contactEmailTo,
      subject: `Nuevo contacto · ${payload.clientName} · ${payload.submitterName}`,
      react: ContactFormSubmission({
        clientName: payload.clientName,
        submitterName: payload.submitterName,
        submitterEmail: payload.submitterEmail,
        submitterPhone: payload.submitterPhone,
        message: payload.message,
        submittedAt: payload.submittedAt,
      }),
    }),
    resend.emails.send({
      from: payload.fromEmail,
      to: payload.submitterEmail,
      subject: `Recibimos tu mensaje · ${payload.clientName}`,
      react: ContactConfirmation({
        clientName: payload.clientName,
        submitterName: payload.submitterName,
        message: payload.message,
      }),
    }),
  ])

  return {
    notification:
      notify.status === "fulfilled" && !notify.value.error
        ? { ok: true, messageId: notify.value.data?.id }
        : { ok: false, error: extractError(notify) },
    confirmation:
      confirm.status === "fulfilled" && !confirm.value.error
        ? { ok: true, messageId: confirm.value.data?.id }
        : { ok: false, error: extractError(confirm) },
  }
}

function extractError(
  result: PromiseSettledResult<{ error?: { message?: string } | null }>,
): string {
  if (result.status === "rejected") {
    return result.reason instanceof Error ? result.reason.message : String(result.reason)
  }
  return result.value.error?.message ?? "unknown_resend_error"
}
