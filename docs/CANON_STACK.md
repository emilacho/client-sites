# Canon Stack Inventory

Status of the `STACK_FINAL_V3` flagship items in this repo as of the
`feat/install-full-canon-stack` PR.

| # | Item | Status | Path / Source |
|---|---|---|---|
| 1 | **shadcn/ui** | ✅ Installed | 14 components at `components/shadcn/` (button · card · input · textarea · label · separator · dialog · accordion · tabs · skeleton · badge · sonner · form · sheet) |
| 2 | **Lucide React** | ✅ Installed | `lucide-react@^0.469` · `pnpm add lucide-react` |
| 3 | **GSAP** | ✅ Installed | `gsap@^3.13` · `pnpm add gsap` · ScrollTrigger included |
| 4 | **Aceternity UI** | ✅ Installed (6/7) | `components/ui/` · spotlight · 3d-card · animated-tooltip · background-beams · bento-grid · meteors. **Sparkles deferred** · upstream `@tsparticles/react` API incompatible (export name + property shape mismatches our strict TS). Re-add when Aceternity updates the registry. |
| 5 | **Magic UI** | ✅ Installed (6/6 + bonus) | `components/shadcn/` · blur-fade · animated-list · marquee · text-reveal · shimmer-button · aurora-text (gradient-text alias) |
| 6 | **Spline 3D** | 🟡 HALT · NEEDS-EMILIO | `SPLINE_API_KEY` not in `zero-risk-platform/.env.local`. Spec calls for Spline Pro $20/mo per STACK_FINAL_V3 · install path is `pnpm add @splinetool/runtime @splinetool/react-spline` once key lands. |
| 7 | **Google Stitch** | 🟡 HALT · NEEDS-EMILIO | No `GOOGLE_STITCH_*` env vars found. Per STACK_FINAL_V3 Google Stitch is a design-to-code SDK that needs a Google Cloud project + API key. Install path TBD once the credential is provisioned. |
| 8 | **21st.dev** | ℹ️ Copy-paste only | No canonical registry root URL (`https://21st.dev/r/registry.json` returns 404). Per-component install via `pnpm dlx shadcn@latest add https://21st.dev/r/<component-slug>.json` works on a case-by-case basis. Decision: defer · pull components on-demand when a section needs one rather than bulk-install. |
| 9 | **UI UX Pro Max skill** | 🟡 HALT · NEEDS-EMILIO | Not present in `zero-risk-platform/src/agents/skills/` (audited 34 skill dirs · ad-creative, copy-editing, page-cro, signup-flow-cro, etc · NO design-flagship skill). Per STACK_FINAL_V3 this is a Z3 Premium skill bundle. Awaiting Emilio's pointer to the skill source repo. |

## Touch policy

Per the dispatch constraint: **the existing Náufrago landing is NOT touched
in this PR.** The new stack lives at `components/shadcn/` and
`components/ui/` (Aceternity files only) and is unreferenced by the
landing's sections · master-workflow v1 will rebuild the sections using
the new toolkit and the brand-strategist + creative-director agents.

## Custom utility primitives kept

The landing's existing custom components in `components/ui/`
(`Button.tsx`, `Input.tsx`, `WhatsAppButton.tsx`) stay in place to keep
the live Náufrago site bit-for-bit identical. shadcn variants are at
`components/shadcn/button.tsx` etc. so both can coexist · the master
workflow can pick whichever fits the section it's regenerating.
