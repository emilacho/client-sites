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
  description: string
  /** Round 9 · ingredient line shown on MenuModal cards. */
  ingredients?: string
  tags: string[]
  priceUsd: number
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

// ── 17-item menu (3 + 2 + 1 + 6 + 5) · spec-pinned ────────────────────

const ENCEBOLLADOS: MenuItem[] = [
  {
    id: "encebollado-clasico",
    category: "encebollados",
    name: "Encebollado clásico",
    description:
      "Caldo de albacora con yuca, tomate y cebolla morada. El plato del puerto, hecho como debe ser.",
    ingredients: "Albacora · yuca · cebolla morada · tomate · cilantro · limón",
    tags: ["Plato fuerte", "Clásico"],
    priceUsd: 6.5,
    emoji: "🍲",
    gradient: "from-amber-700 via-amber-500 to-orange-400",
  },
  {
    id: "encebollado-mixto",
    category: "encebollados",
    name: "Encebollado mixto",
    description:
      "Caldo robusto con albacora + camarón fresco del día. Para los que vienen con hambre seria.",
    ingredients: "Albacora · camarón · yuca · cebolla morada · tomate · cilantro",
    tags: ["Plato fuerte", "Mixto", "Del día"],
    priceUsd: 7.5,
    emoji: "🍲",
    gradient: "from-amber-700 via-orange-500 to-rose-400",
  },
  {
    id: "encebollado-pescado",
    category: "encebollados",
    name: "Encebollado de pescado",
    description:
      "Más suave, más limpio. Pescado blanco del día con el mismo caldo costero, sin atajos.",
    ingredients: "Pescado blanco · yuca · cebolla morada · tomate · cilantro",
    tags: ["Plato fuerte", "Más suave"],
    priceUsd: 5.5,
    emoji: "🥣",
    gradient: "from-amber-600 via-yellow-500 to-amber-300",
  },
]

const CEVICHES: MenuItem[] = [
  {
    id: "ceviche-camaron",
    category: "ceviches",
    name: "Ceviche de camarón",
    description:
      "Camarón fresco curtido en limón y naranja agria, con cebolla y cilantro. Se sirve con canguil y chifle.",
    ingredients: "Camarón · limón · naranja agria · cebolla · cilantro · canguil · chifle",
    tags: ["Fresco", "Marino"],
    priceUsd: 8.5,
    emoji: "🦐",
    gradient: "from-cyan-600 via-emerald-500 to-lime-400",
  },
  {
    id: "ceviche-mixto",
    category: "ceviches",
    name: "Ceviche mixto",
    description:
      "Camarón + concha + pescado blanco · combinación del mar costero. Para los que no se deciden.",
    ingredients: "Camarón · concha · pescado blanco · limón · cebolla · cilantro",
    tags: ["Fresco", "Mixto", "Del día"],
    priceUsd: 9.5,
    emoji: "🐚",
    gradient: "from-emerald-600 via-cyan-500 to-sky-400",
  },
]

const OTROS: MenuItem[] = [
  {
    id: "patacones-carne",
    category: "otros",
    name: "Patacones con carne en salsa",
    description:
      "Verde frito dos veces + carne en salsa criolla. El plato para cuando querés algo serio que no sea pescado.",
    ingredients: "Verde · carne · salsa criolla · cebolla · pimiento · tomate",
    tags: ["Plato fuerte", "Carne"],
    priceUsd: 7.5,
    emoji: "🥩",
    gradient: "from-amber-700 via-rose-500 to-orange-500",
  },
]

const BEBIDAS: MenuItem[] = [
  {
    id: "cola",
    category: "bebidas",
    name: "Cola 500 ml",
    description: "Coca-Cola personal, fría como debe estar.",
    ingredients: "Coca-Cola",
    tags: ["Frío"],
    priceUsd: 1.5,
    emoji: "🥤",
    gradient: "from-rose-700 via-red-500 to-amber-400",
  },
  {
    id: "agua-sin-gas",
    category: "bebidas",
    name: "Agua sin gas",
    description: "Botella 500 ml. Lo básico hecho bien.",
    ingredients: "Agua sin gas",
    tags: ["Frío"],
    priceUsd: 1.0,
    emoji: "💧",
    gradient: "from-cyan-700 via-sky-500 to-cyan-300",
  },
  {
    id: "agua-con-gas",
    category: "bebidas",
    name: "Agua con gas",
    description: "Botella 500 ml para limpiar el paladar entre cucharadas.",
    ingredients: "Agua con gas",
    tags: ["Frío"],
    priceUsd: 1.25,
    emoji: "🫧",
    gradient: "from-sky-700 via-cyan-500 to-teal-300",
  },
  {
    id: "jugo-naranja",
    category: "bebidas",
    name: "Jugo de naranja natural",
    description: "Exprimido del día. Sin azúcar añadida, sin agua extra.",
    ingredients: "Naranja exprimida",
    tags: ["Natural", "Del día"],
    priceUsd: 2.5,
    emoji: "🍊",
    gradient: "from-orange-700 via-amber-500 to-yellow-300",
  },
  {
    id: "cerveza-pilsener",
    category: "bebidas",
    name: "Cerveza Pilsener",
    description: "La rubia nacional, helada. El maridaje obvio con ceviche.",
    ingredients: "Pilsener 330 ml",
    tags: ["Frío", "Con alcohol"],
    priceUsd: 2.5,
    emoji: "🍺",
    gradient: "from-amber-700 via-yellow-500 to-amber-300",
  },
  {
    id: "limonada",
    category: "bebidas",
    name: "Limonada natural",
    description: "Limón fresco + hielo + cero pretensión. Refresca y limpia.",
    ingredients: "Limón · agua · azúcar al gusto · hielo",
    tags: ["Natural", "Frío"],
    priceUsd: 2.0,
    emoji: "🍋",
    gradient: "from-lime-600 via-yellow-400 to-amber-300",
  },
]

const EXTRAS: MenuItem[] = [
  {
    id: "patacones",
    category: "extras",
    name: "Patacones (porción)",
    description:
      "Verde aplastado y frito dos veces · corteza crujiente, centro tierno. El acompañante obligado.",
    ingredients: "Verde · sal · aceite",
    tags: ["Acompañante"],
    priceUsd: 3.5,
    emoji: "🍌",
    gradient: "from-emerald-700 via-lime-500 to-amber-300",
  },
  {
    id: "arroz-blanco",
    category: "extras",
    name: "Arroz blanco",
    description: "Porción extra de arroz para meterle al caldo o comer aparte.",
    ingredients: "Arroz · sal · agua",
    tags: ["Acompañante"],
    priceUsd: 1.5,
    emoji: "🍚",
    gradient: "from-slate-300 via-stone-200 to-amber-200",
  },
  {
    id: "salsa-criolla",
    category: "extras",
    name: "Salsa criolla",
    description: "Encurtido fresco · cebolla, tomate, cilantro, limón. Sube el plato un escalón.",
    ingredients: "Cebolla · tomate · cilantro · limón · aceite · sal",
    tags: ["Picante suave"],
    priceUsd: 1.0,
    emoji: "🌶",
    gradient: "from-rose-600 via-orange-500 to-yellow-400",
  },
  {
    id: "encurtido",
    category: "extras",
    name: "Encurtido extra",
    description: "Cebolla curtida + cilantro + limón. Porción adicional para amantes del agrio.",
    ingredients: "Cebolla morada · cilantro · limón · vinagre",
    tags: ["Acompañante"],
    priceUsd: 1.5,
    emoji: "🧅",
    gradient: "from-rose-700 via-pink-500 to-rose-300",
  },
  {
    id: "aguacate",
    category: "extras",
    name: "Aguacate",
    description: "Medio aguacate maduro · cremoso · cortado al momento.",
    ingredients: "Aguacate",
    tags: ["Fresco"],
    priceUsd: 2.0,
    emoji: "🥑",
    gradient: "from-emerald-700 via-lime-500 to-lime-300",
  },
]

export const MENU_ITEMS: MenuItem[] = [
  ...ENCEBOLLADOS,
  ...CEVICHES,
  ...OTROS,
  ...BEBIDAS,
  ...EXTRAS,
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
   *  strip. The 17-item catalog lives in MENU_ITEMS (above) and powers
   *  the MenuModal opened from the cofre. */
  menu: [
    ENCEBOLLADOS[0],
    CEVICHES[0],
    EXTRAS[0],
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
