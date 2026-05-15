/**
 * Per-client configuration · Phase 1 agent dispatch fills this when a new
 * client is cloned from the template via `cp -r apps/template apps/<slug>`.
 *
 * The runtime reads values from environment variables first (so production
 * deploys can override without a code change) and falls back to whatever
 * the agent wrote here for local dev. Keep this file small · brand assets,
 * long copy blocks, and section data live in dedicated content modules.
 */

export interface ClienteConfig {
  /** url-safe slug · matches contact_submissions.client_slug */
  slug: string
  /** human-readable name shown in metadata, email subjects, footer */
  name: string
  /** apex domain · used to build canonical URLs */
  domain: string
  /** email address that receives contact form notifications */
  contactEmailTo: string
  /** sender address for outbound mail · must be Resend-verified */
  fromEmail: string
  /** SEO description · 150-160 chars · used in metadata + OG */
  description: string
  /** primary brand color · HSL triple matching Tailwind --primary */
  brandColorHsl?: string
  /** display font (next/font slug or Google Fonts family) */
  displayFont?: string
}

export const cliente: ClienteConfig = {
  slug: process.env.NEXT_PUBLIC_CLIENT_SLUG ?? "template-placeholder",
  name: process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Cliente Template",
  domain: process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com",
  contactEmailTo: process.env.CONTACT_EMAIL_TO ?? "hello@example.com",
  fromEmail: process.env.RESEND_FROM_EMAIL ?? "noreply@example.com",
  description:
    "Placeholder description · Phase 1 agent dispatch replaces this with the cliente brief copy.",
}
