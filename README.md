# Zero Risk · client-sites

Cliente-agnostic Next.js template for client websites built by the Zero Risk
agentic agency. Single-app repo · `cp -r` this whole thing to spin up a new
client, then fill `cliente.config.ts` + section copy.

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | React 19 |
| Styling | Tailwind CSS v4 | CSS custom properties for per-client brand override |
| Animation | Framer Motion | Subtle hero fade + scroll-reveal in sections |
| Backend | Supabase | Shared with `zero-risk-platform` prod project |
| Validation | Zod | Schema for `/api/contact` body |
| AI images | Zero Risk GPT Image wrapper (Sprint #6 Brazo 1) | `POST /api/images/generate` |
| Tooling | pnpm + TypeScript strict | Node 22 |
| Hosting | Vercel | One project per client |

Contact form persists to `contact_submissions` (Supabase service-role).
Email delivery and anti-spam (Turnstile) are deferred · post-launch
pickup job will scan `WHERE notification_sent = FALSE`.

## Structure

```
client-sites/
├── app/
│   ├── layout.tsx              HTML shell + metadata + Inter font
│   ├── page.tsx                landing · composed from sections/
│   ├── api/contact/route.ts    POST · Zod validate · Supabase insert
│   ├── thanks/page.tsx         post-submit confirmation
│   ├── sitemap.ts              dynamic sitemap
│   ├── robots.ts               public + sitemap reference
│   └── globals.css             Tailwind v4 + CSS custom properties theme
├── components/
│   ├── sections/               Hero · Services · About · CTA · Contact · Footer
│   ├── ContactForm.tsx         client component · POST handler
│   └── ui/                     Button, Input, Label, Textarea (utility-class primitives · no shadcn dep)
├── lib/
│   ├── supabase.ts             server client · service-role · cached
│   └── schemas.ts              Zod contact submission schema
├── cliente.config.ts           ← Phase 1 agent dispatch fills this
├── __tests__/contact-route.test.ts (5 cases · vitest)
└── .github/workflows/ci.yml    typecheck + lint + test + build on PR/push
```

## Adding a new client (Phase 1+ workflow)

```bash
# 1. Clone repo for the new client
git clone https://github.com/emilacho/client-sites.git client-sites-<slug>
cd client-sites-<slug>
rm -rf .git && git init -b main

# 2. Customize cliente.config.ts (Phase 1 agents fill this automatically)
#    - slug, name, domain, description, brand color, font

# 3. New Vercel project
vercel link

# 4. Set per-client env vars in Vercel dashboard:
#    - NEXT_PUBLIC_CLIENT_SLUG=<slug>
#    - NEXT_PUBLIC_CLIENT_NAME="<Display Name>"
#    - NEXT_PUBLIC_SITE_URL=https://<cliente-domain>
#    - SUPABASE_URL=... (shared prod)
#    - SUPABASE_SERVICE_ROLE_KEY=... (shared prod)

# 5. Push · auto-deploys
```

## Local development

```bash
pnpm install
cp .env.example .env.local      # then fill
pnpm dev                        # localhost:3000
pnpm test                       # 5/5 vitest
pnpm verify                     # typecheck + lint + test
```

## Brand tokens (per-client override)

`app/globals.css` exposes the Tailwind theme as HSL CSS custom properties.
Per-client deploys can override by editing this file (or by injecting a
`<style>` block at runtime keyed on `cliente.brandColorHsl`):

```css
@layer base {
  :root {
    --primary: 240 100% 50%;     /* brand color */
    --radius: 0.25rem;
  }
}
```

## License

AGPL-3.0. Consistent with the `mission-control` fork and the broader Zero Risk
open-source posture. Commercial use is allowed; modifications must be shared
back if the modified code is exposed over a network.
