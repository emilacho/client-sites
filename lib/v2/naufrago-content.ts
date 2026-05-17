/**
 * Náufrago v2 cascade content · pinned from Storage outputs
 * (client-websites/naufrago/v2/agents-outputs/) so the landing page
 * stays deterministic across deploys. Values came from the cascade
 * verified 19/19 green (CC#2 · 2026-05-17).
 *
 * Round 9.5 · MENU_ITEMS replaced with the canonical 17-item menu
 * sourced from the real menu photo (`raw/state/2026-05-16-naufrago-
 * menu-shopping-cart-spec.md`). The previous values shipped in
 * Round 9 were placeholders · this revision honors the exact ids,
 * names, ingredient lists, and prices from the spec.
 *
 * POV unification · voice is `tú` everywhere · hero / CTAs / about /
 * contact. The cascade already lands on tú · this file keeps that
 * contract explicit for the audit.
 */

export type MenuCategoryId =
  | "encebollados"
  | "ceviches"
  | "otros"
  | "bebidas"
  | "extras"

export interface MenuItem {
  id: string
  /** Round 9 · category drives the MenuModal tabs (Encebollados 3 ·
   *  Ceviches 2 · Otros 1 · Bebidas 6 · Extras 5 · spec-pinned 17). */
  category: MenuCategoryId
  name: string
  /** Round 9.5 · optional secondary label from spec (e.g. "Pequeño"
   *  on Encebollado Junior). Not rendered by the current MenuModal
   *  UI · preserved for future surfaces that need it. */
  subtitle?: string
  description: string
  /** Round 9.5 · ingredient line shown on MenuModal cards. Stored as
   *  a single string joined with " · " so the existing modal markup
   *  (which renders ingredients as one `<p>` block) keeps working
   *  without UI changes. */
  ingredients?: string
  tags: string[]
  priceUsd: number
  /** Round 9.5 · marks items that are service fees (not food) ·
   *  currently only `para-llevar`. Optional · used by downstream
   *  consumers that need to exclude service fees from totals. */
  type?: "service_fee"
  /** Display-only · simple emoji + gradient stand-in until real
   *  food photography lands in `client-websites/naufrago/v2/menu/`. */
  emoji: string
  /** Tailwind gradient classes for the 2D thumbnail. */
  gradient: string
}

export const MENU_CATEGORIES: Array<{ id: MenuCategoryId; label: string; emoji: string }> = [
  { id: "encebollados", label: "Encebollados", emoji: "🍲" },
  { id: "ceviches",     label: "Ceviches",     emoji: "🦐" },
  { id: "otros",        label: "Otros",        emoji: "🍴" },
  { id: "bebidas",      label: "Bebidas",      emoji: "🥤" },
  { id: "extras",       label: "Extras",       emoji: "🍌" },
]

// ── Canonical 17-item menu · sourced from raw/state/2026-05-16-
//    naufrago-menu-shopping-cart-spec.md (foto del menú real). Names,
//    ingredients, and prices are spec-pinned · descriptions are kept
//    minimal/factual since the spec doesn't dictate them.

export const MENU_ITEMS: MenuItem[] = [
  // ── Encebollados (3) ───────────────────────────────────────────────
  {
    id: "encebollado-naufrago",
    category: "encebollados",
    name: "Encebollado Náufrago",
    description: "El de la casa · porción estándar.",
    ingredients: "Pescado 100g · Yuca · Cebolla · Chifle o Pan",
    tags: [],
    priceUsd: 4.0,
    emoji: "🍲",
    gradient: "from-amber-700 via-amber-500 to-orange-400",
  },
  {
    id: "encebollado-mixto",
    category: "encebollados",
    name: "Encebollado Mixto",
    description: "Encebollado con camarón y pescado.",
    ingredients: "Camarón · Pescado 100g · Yuca · Cebolla · Chifle o Pan",
    tags: [],
    priceUsd: 6.0,
    emoji: "🍲",
    gradient: "from-amber-700 via-orange-500 to-rose-400",
  },
  {
    id: "encebollado-junior",
    category: "encebollados",
    name: "Encebollado Junior",
    subtitle: "Pequeño",
    description: "Porción pequeña · 45g de pescado.",
    ingredients: "Pescado 45g · Yuca · Cebolla · Chifle o Pan",
    tags: [],
    priceUsd: 3.5,
    emoji: "🥣",
    gradient: "from-amber-600 via-yellow-500 to-amber-300",
  },

  // ── Ceviches (2) ──────────────────────────────────────────────────
  {
    id: "ceviche-naufrago",
    category: "ceviches",
    name: "Ceviche Náufrago",
    description: "El de la casa · con leche de tigre y salsa de maní.",
    ingredients:
      "Pescado curtido 200g · Leche de tigre · Aguacate · Salsa de maní · Chifle · Tomate cebolla pimiento",
    tags: [],
    priceUsd: 7.0,
    emoji: "🐟",
    gradient: "from-cyan-600 via-emerald-500 to-lime-400",
  },
  {
    id: "ceviche-mixto",
    category: "ceviches",
    name: "Ceviche Mixto",
    description: "Camarón + pescado curtido · misma leche de tigre.",
    ingredients:
      "Camarón · Pescado curtido 200g · Leche de tigre · Aguacate · Salsa de maní · Chifle · Tomate cebolla pimiento",
    tags: [],
    priceUsd: 9.0,
    emoji: "🦐",
    gradient: "from-emerald-600 via-cyan-500 to-sky-400",
  },

  // ── Otros (1) ─────────────────────────────────────────────────────
  {
    id: "patacones-naufrago",
    category: "otros",
    name: "Patacones Náufrago",
    description: "Verdes fritos con queso, huevo y sal prieta.",
    ingredients: "12-15 Patacones · Queso · Huevo frito · Sal prieta",
    tags: [],
    priceUsd: 4.0,
    emoji: "🍌",
    gradient: "from-amber-700 via-yellow-500 to-lime-400",
  },

  // ── Bebidas (6) ───────────────────────────────────────────────────
  {
    id: "jugo-natural",
    category: "bebidas",
    name: "Jugo natural del día",
    description: "Sabor del día.",
    tags: [],
    priceUsd: 2.0,
    emoji: "🍹",
    gradient: "from-orange-700 via-amber-500 to-yellow-300",
  },
  {
    id: "cola-grande",
    category: "bebidas",
    name: "Cola grande",
    description: "",
    tags: [],
    priceUsd: 2.0,
    emoji: "🥤",
    gradient: "from-rose-700 via-red-500 to-amber-400",
  },
  {
    id: "cerveza-grande",
    category: "bebidas",
    name: "Cerveza grande",
    description: "",
    tags: [],
    priceUsd: 3.0,
    emoji: "🍺",
    gradient: "from-amber-700 via-yellow-500 to-amber-300",
  },
  {
    id: "agua",
    category: "bebidas",
    name: "Agua",
    description: "",
    tags: [],
    priceUsd: 1.0,
    emoji: "💧",
    gradient: "from-cyan-700 via-sky-500 to-cyan-300",
  },
  {
    id: "cafe-pasado",
    category: "bebidas",
    name: "Café pasado",
    description: "",
    tags: [],
    priceUsd: 2.0,
    emoji: "☕",
    gradient: "from-amber-900 via-amber-700 to-amber-500",
  },
  {
    id: "cola-pequena",
    category: "bebidas",
    name: "Cola pequeña",
    description: "",
    tags: [],
    priceUsd: 1.25,
    emoji: "🥤",
    gradient: "from-rose-600 via-red-500 to-amber-300",
  },

  // ── Extras (5) ────────────────────────────────────────────────────
  {
    id: "extra-chifle",
    category: "extras",
    name: "Chifle",
    description: "",
    tags: [],
    priceUsd: 0.5,
    emoji: "🍌",
    gradient: "from-emerald-700 via-lime-500 to-amber-300",
  },
  {
    id: "extra-pan",
    category: "extras",
    name: "Pan",
    description: "",
    tags: [],
    priceUsd: 0.5,
    emoji: "🍞",
    gradient: "from-amber-600 via-yellow-400 to-amber-200",
  },
  {
    id: "extra-huevo",
    category: "extras",
    name: "Huevo",
    description: "",
    tags: [],
    priceUsd: 0.5,
    emoji: "🥚",
    gradient: "from-yellow-500 via-amber-300 to-stone-200",
  },
  {
    id: "extra-aguacate",
    category: "extras",
    name: "Aguacate",
    description: "",
    tags: [],
    priceUsd: 1.0,
    emoji: "🥑",
    gradient: "from-emerald-700 via-lime-500 to-lime-300",
  },
  {
    id: "para-llevar",
    category: "extras",
    name: "Para llevar",
    description: "Cargo por empaque.",
    tags: [],
    priceUsd: 1.0,
    type: "service_fee",
    emoji: "🥡",
    gradient: "from-slate-700 via-stone-600 to-stone-400",
  },
]

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
  /** Legacy 3-item quick list · still consumed by MenuQuickAdd bottom
   *  strip. Picks one canonical item per plate category (Encebollado
   *  Náufrago · Ceviche Náufrago · Patacones Náufrago). The 17-item
   *  catalog lives in MENU_ITEMS (above) and powers the MenuModal
   *  opened from the cofre. */
  menu: [
    MENU_ITEMS.find((i) => i.id === "encebollado-naufrago")!,
    MENU_ITEMS.find((i) => i.id === "ceviche-naufrago")!,
    MENU_ITEMS.find((i) => i.id === "patacones-naufrago")!,
  ] satisfies MenuItem[],
} as const

// ── GLB asset URLs · Supabase public bucket · zero auth needed ───────
const SUPABASE_BASE =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://ordaeyxvvvdqsznsecjx.supabase.co"
const ASSET_BASE = `${SUPABASE_BASE}/storage/v1/object/public/client-websites/naufrago`

export const naufragoAssets = {
  // The `-optimized` variant of the island GLB is corrupt at the
  // source (buffer offsets misaligned · GLTFLoader throws
  // "Invalid typed array length: 4281" parsing accessor 0). The
  // unoptimized canonical variant parses cleanly. Re-export +
  // re-upload of the optimized version is a follow-up · the size
  // delta (4 MB → 25 MB) is acceptable for the preview while it's
  // pending. Diagnostic: `client-sites/scripts/test-glb-parse.mjs`.
  island:    `${ASSET_BASE}/3d-models/island-low-poly.glb`,
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
