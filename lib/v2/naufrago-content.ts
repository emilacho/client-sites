/**
 * Náufrago v2 cascade content · pinned from Storage outputs
 * (client-websites/naufrago/v2/agents-outputs/) so the landing page
 * stays deterministic across deploys. Values came from the cascade
 * verified 19/19 green (CC#2 · 2026-05-17).
 *
 * POV unification · voice is `tú` everywhere · hero / CTAs / menu
 * cards / about / contact. The cascade already lands on tú · this
 * file keeps that contract explicit for the audit.
 */

export interface MenuItem {
  id: string
  name: string
  description: string
  tags: string[]
  priceUsd: number
  /** Display-only · simple emoji + gradient stand-in until real
   *  food photography lands in `client-websites/naufrago/v2/menu/`. */
  emoji: string
  /** Tailwind gradient classes for the 2D thumbnail. */
  gradient: string
}

export const naufragoV2 = {
  hero: {
    headline: "Del mar a tu puerta, hoy.",
    subheadline:
      "Encebollados, ceviches y patacones con producto del día — sin esperar mesa, sin salir de casa.",
    ctaPrimary: "Pedir por WhatsApp",
    ctaSecondary: "Ver menú",
  },
  about: {
    title: "Cocinamos como se cocina en el puerto",
    body:
      "Náufrago nació en Olón para resolver lo que ningún restaurante resuelve: mariscos frescos, a tiempo, sin que tengas que ir a buscarlos.\n\nUsamos producto del día y recetas de costa. Sin atajos, sin congelados, sin esperas de mesa.\n\nPides por WhatsApp, nosotros cocinamos. Así de directo.",
  },
  testimonials: [
    {
      id: "tst-1",
      author: "María C.",
      city: "Olón",
      body:
        "Pedí encebollado a las 11am y llegó a las 11:35am tibio, caldo perfecto. Mejor que cualquier mesa.",
      rating: 5,
    },
    {
      id: "tst-2",
      author: "Diego R.",
      city: "Manglaralto",
      body:
        "El ceviche tiene sabor de mercado · fresco, ácido justo. Repetí dos veces el mismo finde.",
      rating: 5,
    },
    {
      id: "tst-3",
      author: "Andrea P.",
      city: "Punta Blanca",
      body:
        "Pides por WhatsApp y listo. Nada de filas, nada de esperas. Lo que más me gusta es lo directo del trato.",
      rating: 5,
    },
  ],
  contact: {
    title: "¿Tienes hambre? Nosotros cocinamos.",
    whatsappCta: "Escribir por WhatsApp",
    hoursLabel: "Horario de pedidos",
  },
  menu: [
    {
      id: "encebollado",
      name: "Encebollado",
      description:
        "Caldo de albacora con yuca, tomate y cebolla morada. El plato del puerto, hecho como debe ser.",
      tags: ["Plato fuerte", "Clásico costero", "Del día"],
      priceUsd: 6.5,
      emoji: "🍲",
      gradient: "from-amber-700 via-amber-500 to-orange-400",
    },
    {
      id: "ceviche",
      name: "Ceviche",
      description:
        "Mariscos frescos curtidos en limón y naranja agria, con cebolla y cilantro. Se sirve con canguil y chifle.",
      tags: ["Fresco", "Del día", "Marino"],
      priceUsd: 8.5,
      emoji: "🦐",
      gradient: "from-cyan-600 via-emerald-500 to-lime-400",
    },
    {
      id: "patacones",
      name: "Patacones",
      description:
        "Verde aplastado y frito dos veces: corteza crujiente, centro tierno. El acompañante obligado de la costa.",
      tags: ["Acompañante", "Para compartir"],
      priceUsd: 3.5,
      emoji: "🍌",
      gradient: "from-emerald-700 via-lime-500 to-amber-300",
    },
  ] satisfies MenuItem[],
} as const

// ── GLB asset URLs · Supabase public bucket · zero auth needed ───────
const SUPABASE_BASE =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://ordaeyxvvvdqsznsecjx.supabase.co"
const ASSET_BASE = `${SUPABASE_BASE}/storage/v1/object/public/client-websites/naufrago`

export const naufragoAssets = {
  island:    `${ASSET_BASE}/3d-models/island-low-poly-optimized.glb`,
  character: `${ASSET_BASE}/3d-models/character-castaway-confused-scratch.glb`,
  sign:      `${ASSET_BASE}/3d-models/sign-naufrago.glb`,
  surfboard: `${ASSET_BASE}/3d-models/surfboard-old.glb`,
  heroImage: `${ASSET_BASE}/v2/hero.png`,
} as const

// ── WhatsApp checkout template · spec-pinned ──────────────────────────
export const WHATSAPP_E164 = "593997744288"

export interface CartLine {
  id: string
  name: string
  priceUsd: number
  qty: number
}

export function buildWhatsAppMessage(lines: CartLine[]): string {
  if (lines.length === 0) {
    return "Hola, quiero pedir."
  }
  const items = lines
    .map((l) => `• ${l.qty}× ${l.name} — $${(l.priceUsd * l.qty).toFixed(2)}`)
    .join("\n")
  const total = lines.reduce((s, l) => s + l.priceUsd * l.qty, 0).toFixed(2)
  return [
    "¡Hola Náufrago! Quiero pedir lo siguiente:",
    "",
    items,
    "",
    `Total: $${total}`,
    "",
    "¿Me confirmas tiempo de entrega? Gracias.",
  ].join("\n")
}

export function buildWhatsAppLink(lines: CartLine[]): string {
  const msg = buildWhatsAppMessage(lines)
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(msg)}`
}
