# Zero Risk · client-sites

Cliente-agnostic monorepo for client websites built by the Zero Risk agentic agency.

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router) | React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui | CSS variables for per-client brand override |
| Forms | Cloudflare Turnstile | Anti-spam · invisible CAPTCHA replacement |
| Email | Resend + react-email | Temporary · backlog migrate to GHL post-launch |
| Backend | Supabase | Shared with `zero-risk-platform` prod project |
| Build | Turborepo + pnpm workspaces | Node 22 |
| Hosting | Vercel | One project per client |
| AI images | Zero Risk GPT Image wrapper (Sprint #6 Brazo 1) | `POST /api/images/generate` |

## Structure

```
client-sites/
├── apps/
│   └── template/                  ← cliente-agnostic Next.js 15 skeleton
│       ├── app/
│       ├── components/sections/
│       ├── lib/
│       ├── cliente.config.ts      ← Phase 1 agent dispatch fills this
│       └── __tests__/
├── packages/
│   ├── ui/                        ← shadcn/ui shared components
│   ├── email/                     ← Resend + react-email templates
│   ├── db/                        ← Supabase migrations
│   ├── eslint-config/             ← shared next/core-web-vitals
│   └── typescript-config/         ← shared tsconfig base/nextjs
├── docs/
│   └── AGENT_INTEGRATION.md       ← Phase 1 agent dispatch contract
└── .github/workflows/
    └── ci.yml                     ← typecheck + lint + test on PR
```

## Adding a new client (Phase 1+ workflow)

```bash
# 1. Clone template
cp -r apps/template apps/<cliente-slug>

# 2. Customize via cliente.config.ts (Phase 1 agents fill this automatically)
#    - name, slug, domain, brand colors, copy blocks, contact email

# 3. New Vercel project pointing at apps/<cliente-slug>
vercel link --project client-sites-<cliente-slug>

# 4. Set per-client env vars in Vercel dashboard:
#    - CONTACT_EMAIL_TO=<client-email>
#    - NEXT_PUBLIC_CLIENT_SLUG=<cliente-slug>
#    - NEXT_PUBLIC_CLIENT_NAME="<Display Name>"
#    - NEXT_PUBLIC_SITE_URL=https://<cliente-domain>

# 5. Push · auto-deploys
```

## Local development

```bash
pnpm install          # at repo root · installs all workspaces
pnpm dev              # turbo runs all dev tasks
pnpm build            # build everything
pnpm verify           # typecheck + lint + test
```

## License

AGPL-3.0. Consistent with the `mission-control` fork and the broader Zero Risk
open-source posture. Commercial use is allowed; modifications must be shared
back if the modified code is exposed over a network.
