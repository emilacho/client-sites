/**
 * Náufrago landing v1 · sourced from real agent outputs (master workflow
 * execution_id 7196 · 2026-05-16). Files at
 * `client-websites/naufrago-ec/` Supabase Storage:
 *  - cascade-summary.json
 *  - agents-outputs/{brand-strategist,creative-director,market_research_analyst,
 *    web-designer,marketing_content_creator,editor-en-jefe}.json
 *  - hero.png
 *
 * Editor-en-Jefe verdict · APPROVED · severity=low.
 *
 * NO manual copy overrides · agent outputs are the source of truth.
 */

export interface ClienteConfig {
  slug: string
  name: string
  domain: string
  description: string
  whatsappE164: string
  whatsappDisplay: string
  instagram: string
  address: string
  schedule: string
  scheduleShort: string
  positioningStatement: string
  taglineHero: string
  followersCount: number
}

export const cliente: ClienteConfig = {
  slug: process.env.NEXT_PUBLIC_CLIENT_SLUG ?? "naufrago",
  name: process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Náufrago",
  domain:
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://client-sites-template.vercel.app",
  description:
    "Ceviche y encebollado con el marisco más fresco de Olón, hecho con alma de playa y entregado directo a tu puerta. Porque el mar no debería estar lejos del almuerzo.",
  whatsappE164: "593997744288",
  whatsappDisplay: "0997744288",
  instagram: "naufrago.ec",
  address: "Calle de los Paraguas, frente al Hostal Isramar · Olón, Santa Elena",
  schedule: "Jueves a Lunes · 9:00 AM – 5:00 PM",
  scheduleShort: "Jue–Lun · 9am–5pm",
  positioningStatement:
    "Náufrago es la cocina costera de Olón que transforma el marisco más fresco de la zona en ceviches y encebollados con alma de playa — servidos directo a tu puerta de jueves a lunes, para que cada bocado sepa a mar recién salido.",
  taglineHero: "Fresco como recién salido del mar",
  followersCount: 1218,
}

export const whatsappLink = (text = "Hola, quiero pedir") =>
  `https://wa.me/${cliente.whatsappE164}?text=${encodeURIComponent(text)}`

export const instagramLink = `https://www.instagram.com/${cliente.instagram}/`
