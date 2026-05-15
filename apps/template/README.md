# apps/template · Customization Guide

Cliente-agnostic Next.js 15 skeleton. New clients clone this directory and
fill `cliente.config.ts` (manually or via Phase 1 agent dispatch).

## Sections

The landing page is composed from `components/sections/`:

| Section | Purpose | Customize |
|---|---|---|
| `HeroSection` | Above-the-fold pitch | `cliente.name` + `cliente.description` |
| `ServicesSection` | 3-card service grid | Replace `PLACEHOLDER_SERVICES` array |
| `AboutSection` | Trust block · history, team, credentials | Edit the paragraph copy |
| `CTASection` | Mid-page conversion push | Tweak heading + button copy |
| `ContactSection` | Form anchor | Wire `ContactForm` (already done) |
| `Footer` | Legal + agency credit | Auto-pulls `cliente.name` |

## Contact form pipeline

```
ContactForm (client)
  ↓ POST /api/contact
app/api/contact/route.ts
  → Zod validate
  → Turnstile verify (skip in local dev if no secret)
  → INSERT contact_submissions (Supabase service-role)
  → sendContactEmails() · Resend × 2 in parallel
  → UPDATE row with delivery state
  → redirect /thanks
```

Failure modes:
- 400 validation_failed → form shows error inline
- 403 turnstile_failed → form shows error inline (re-render Turnstile)
- 500 persist_failed → form shows error (NO email sent, NO row written · retry safe)
- 200 with `confirmation_sent: false` → row persisted, partial email failure
  · pickup by retry job (not yet built · backlog)

## Required environment variables

```
# Supabase (shared with zero-risk-platform prod)
SUPABASE_URL=https://ordaeyxvvvdqsznsecjx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...

# Resend
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@<cliente-domain>

# Cloudflare Turnstile
NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITE_KEY=0x4AAAAAAA...
CLOUDFLARE_TURNSTILE_SECRET_KEY=0x4AAAAAAA...

# Per-client identity
CONTACT_EMAIL_TO=hello@<cliente-domain>
NEXT_PUBLIC_CLIENT_SLUG=<cliente-slug>
NEXT_PUBLIC_CLIENT_NAME="<Display Name>"
NEXT_PUBLIC_SITE_URL=https://<cliente-domain>
```

## Local dev

```bash
pnpm install        # at repo root
cp .env.example .env.local    # then fill
pnpm dev            # localhost:3000
pnpm test           # 5/5 vitest
pnpm build          # production build
```

## Adding sections

1. Create `components/sections/<Name>.tsx`
2. Import + render in `app/page.tsx`
3. Use components from `@client-sites/ui` (Button, Card, etc.) so the brand
   tokens propagate · don't hand-roll inline styles.

## Brand tokens (per-client override)

The shared `packages/ui/src/styles/globals.css` exposes Tailwind theme as
HSL CSS custom properties. Override per-client by editing this app's
`app/globals.css`:

```css
@import "@client-sites/ui/globals.css";

@layer base {
  :root {
    --primary: 240 100% 50%;     /* override brand color */
    --radius: 0.25rem;            /* override corner roundness */
  }
}
```
