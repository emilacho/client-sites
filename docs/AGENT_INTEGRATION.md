# Agent Integration · Phase 1 contract

How the Zero Risk agentic agency fills a `client-sites/apps/<cliente-slug>/`
deploy from a client brief. Read this before dispatching agents at any
slug-specific work.

## Lifecycle

```
Phase 0 · scaffolding (THIS REPO · cliente-agnostic)
  └── apps/template + packages/* live in main

Phase 1 · cliente-specific
  ├── 1a. Brand discovery agent       → cliente brief markdown
  ├── 1b. Content strategist agent    → section copy blocks
  ├── 1c. Creative director agent     → hero image via Zero Risk GPT Image wrapper
  ├── 1d. Tracking specialist agent   → GA4 + Meta Pixel snippets
  └── 1e. Slug-init dispatch          → cp -r apps/template apps/<slug> + fill cliente.config.ts

Phase 2 · per-client deploy
  ├── Vercel project link
  ├── Per-client env vars set
  ├── Domain DNS pointed at Vercel
  └── First push · auto-deploy
```

## `cliente.config.ts` contract

Every per-client app exports a `cliente` constant matching this shape:

```ts
export const cliente: ClienteConfig = {
  slug: string,                  // url-safe · matches contact_submissions.client_slug
  name: string,                  // human-readable display name
  domain: string,                // apex URL · used for canonical, sitemap, OG
  contactEmailTo: string,        // where contact form notifications go
  fromEmail: string,             // Resend sender (must be domain-verified)
  description: string,           // 150-160 char SEO description
  brandColorHsl?: string,        // optional · "240 100% 50%" Tailwind --primary override
  displayFont?: string,          // optional · Google Fonts family
}
```

The runtime prefers env vars over the literal values, so Phase 2 deploys
can override without a code change. Phase 1 agents should:

1. Generate the literal `cliente` block as a fallback for local dev
2. Emit a `.env.example` with the same values as env vars (for prod)
3. Document the section copy in `components/sections/` files
4. Drop the hero image URL (from Zero Risk GPT Image wrapper · returns
   Supabase Storage public URL) into the hero section

## Image generation handoff

The Creative Director agent calls Zero Risk's GPT Image wrapper:

```bash
POST https://zero-risk-platform.vercel.app/api/images/generate
{
  "prompt": "<brand-aligned hero image prompt>",
  "client_id": "<cliente UUID from clients table>",
  "agent_slug": "creative-director",
  "caller": "phase1-<cliente-slug>-hero"
}
```

Response includes a public Storage URL · paste it into
`apps/<slug>/components/sections/HeroSection.tsx` as the `src` of a
`next/image` component.

## Section content discipline

Sections in `apps/template/` carry placeholder copy. Phase 1 agents MUST
replace the placeholders before deploy · the `Phase 1 agent fills this`
strings are search-anchored so a final pre-deploy lint can grep for them
and block ship if any survive.

## Database

All apps write to `contact_submissions` discriminated by
`client_slug`. NO per-client table. NO per-client RLS · service-role
writes only.
