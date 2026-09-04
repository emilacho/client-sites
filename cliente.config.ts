import { COCINA_ABRE_H, COCINA_CIERRA_H } from "@/lib/horario"

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

/** R96.13 · day-of-week index igual a `Date.getDay()` · 0=Domingo · 6=Sábado.
 *  Cada día acepta una ventana [openHour, closeHour] en hora local del local
 *  (Ecuador · UTC-5 sin DST). null = cerrado ese día. */
export type BusinessHours = Readonly<{
  0: [number, number] | null
  1: [number, number] | null
  2: [number, number] | null
  3: [number, number] | null
  4: [number, number] | null
  5: [number, number] | null
  6: [number, number] | null
}>

/** IANA timezone del local · usado por el hook `useBusinessHours` para
 *  evaluar open/closed con la hora real del local, no del browser. */
export const CLIENTE_TZ = "America/Guayaquil"

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
  businessHours: BusinessHours
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
  address: "Avenida 8 NO · Urdenor 1 · Tarqui, Guayaquil",
  // R162 · el horario sale de `lib/horario.ts` · acá ya no se escribe a
  // mano. Antes este bloque decía 9-17 mientras las preguntas frecuentes
  // decían 11-22: el cartel de "abierto" y el texto se contradecían.
  schedule: "Jueves a Lunes · 7:00 AM – 3:00 PM",
  scheduleShort: "Jue–Lun · 7am–3pm",
  businessHours: {
    0: [COCINA_ABRE_H, COCINA_CIERRA_H],  // Domingo
    1: [COCINA_ABRE_H, COCINA_CIERRA_H],  // Lunes
    2: null,                              // Martes · cerrado
    3: null,                              // Miércoles · cerrado
    4: [COCINA_ABRE_H, COCINA_CIERRA_H],  // Jueves
    5: [COCINA_ABRE_H, COCINA_CIERRA_H],  // Viernes
    6: [COCINA_ABRE_H, COCINA_CIERRA_H],  // Sábado
  },
  positioningStatement:
    "Náufrago es la cocina costera de Olón que transforma el marisco más fresco de la zona en ceviches y encebollados con alma de playa — servidos directo a tu puerta de jueves a lunes, para que cada bocado sepa a mar recién salido.",
  taglineHero: "Fresco como recién salido del mar",
  followersCount: 1218,
}

export const whatsappLink = (text = "Hola, quiero pedir") =>
  `https://wa.me/${cliente.whatsappE164}?text=${encodeURIComponent(text)}`

export const instagramLink = `https://www.instagram.com/${cliente.instagram}/`
