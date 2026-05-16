/**
 * Náufrago landing v2 · the landing-v2 branch rewires the root page
 * to the v2 experience (3D scene + drei <Html> anchored overlays +
 * Amazon-style cart with WhatsApp checkout).
 *
 * The v1 sectioned page (HeroSection / MenuSection / AboutSection /
 * CTASection / ContactSection / Footer) remains on main · this branch
 * deploys as a preview at `landing-v2` and is reviewable before merge.
 */
import type { Metadata } from "next"
import { cliente } from "@/cliente.config"
import { naufragoV2 } from "@/lib/v2/naufrago-content"
import LandingV2 from "@/components/v2/LandingV2"

export const metadata: Metadata = {
  title: `${cliente.name} · ${naufragoV2.hero.headline}`,
  description: naufragoV2.hero.subheadline,
}

export default function Page() {
  return <LandingV2 />
}
