/**
 * Per-client configuration · Phase 1 deploy
 *
 * Cliente: Náufrago · ceviche + encebollado · ghost kitchen Olón Santa Elena Ecuador
 * Diferenciador: "el más fresco de la zona"
 * Source: outputs/naufrago-instagram-scrape.json (@naufrago.ec · 1218 followers · IG business account)
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
}

export const cliente: ClienteConfig = {
  slug: process.env.NEXT_PUBLIC_CLIENT_SLUG ?? "naufrago",
  name: process.env.NEXT_PUBLIC_CLIENT_NAME ?? "Náufrago",
  domain:
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://naufrago-landing.vercel.app",
  description:
    "Ceviche y encebollado de albacora fresca · Olón, Santa Elena · de Jueves a Lunes · el más fresco de la zona.",
  whatsappE164: "593997744288",
  whatsappDisplay: "0997744288",
  instagram: "naufrago.ec",
  address: "Calle de los Paraguas, frente al Hostal Isramar · Olón, Santa Elena",
  schedule: "Jueves a Lunes · 9:00 AM – 5:00 PM",
}

export const whatsappLink = (text = "Hola, quiero pedir") =>
  `https://wa.me/${cliente.whatsappE164}?text=${encodeURIComponent(text)}`

export const instagramLink = `https://www.instagram.com/${cliente.instagram}/`
