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

/** R96.20 · modificadores per ítem · cliente puede tunear el plato
 *  desde el menu modal. priceDelta puede ser 0 (sin costo) · positivo
 *  (cargo extra) · o negativo (rebaja por sacar algo). */
export interface MenuItemModifier {
  id: string
  label: string
  priceDelta: number
  defaultOn?: boolean
}

/** R96.27 · ingredient toggle unificado · cliente ajusta cantidad o
 *  agrega add-ons con la misma UX tri-state (-/0/+). Reemplaza la
 *  separación previa modifiers vs ingredientToggles · todo va a un
 *  solo array `ingredientToggles` que el panel renderiza uniforme.
 *
 *  - Si removeLabel === null/undefined · el "-" está disabled (es un
 *    add-on que no viene por default · solo permite 0 → +1). Ejemplo ·
 *    aguacate · doble camarón · pescado adicional.
 *  - Si removeLabel está · el ingrediente viene por default y cliente
 *    puede ir a -1 (sin X). Ejemplo · cebolla · chifle · yerbita.
 *  - extraPriceDelta · cargo cuando state=+1 (default 0).
 */
export interface MenuItemIngredientToggle {
  id: string
  label: string
  emoji?: string
  removeLabel?: string
  extraLabel: string
  extraPriceDelta?: number
}

/** R96.28 · brand badge SVG inline data URL · genera placeholder
 *  branded para cada variant de cola sin dependencia CDN externa.
 *  Brand colors + wordmark grande · visualmente más distintivo
 *  que emoji genérico 🥤. */
function brandBadgeUrl(bg1: string, bg2: string, fg: string, label: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 200'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='${bg1}'/>` +
    `<stop offset='1' stop-color='${bg2}'/>` +
    `</linearGradient></defs>` +
    `<rect width='200' height='200' rx='24' fill='url(#g)'/>` +
    `<text x='100' y='115' text-anchor='middle' font-family='Inter,system-ui,sans-serif' font-size='26' font-weight='900' fill='${fg}'>${label}</text>` +
    `</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

/** R96.25 · variants single-select · cliente elige UNO de N obligatorio
 *  antes de agregar al cart. Usado para bebidas brand-multi · jugos por
 *  sabor · etc. priceDelta normalmente 0 (el variant es el "subtipo"
 *  del ítem · no un add-on). imageUrl opcional · si presente se renderiza
 *  la foto · si null cae a emoji + color. */
export interface MenuItemVariant {
  id: string
  label: string
  priceDelta: number
  imageUrl?: string
  emoji?: string
  /** Tailwind gradient classes · fallback visual cuando no hay imageUrl. */
  gradient?: string
}

/** R96.12 · allergen taxonomy estándar EC food delivery. */
export type AllergenId =
  | "pescado"
  | "mariscos"
  | "mani"
  | "gluten"
  | "lacteo"
  | "huevo"

export const ALLERGEN_LABELS: Record<AllergenId, { emoji: string; label: string }> = {
  pescado:  { emoji: "🐟", label: "Pescado" },
  mariscos: { emoji: "🦐", label: "Mariscos" },
  mani:     { emoji: "🥜", label: "Maní" },
  gluten:   { emoji: "🌾", label: "Gluten" },
  lacteo:   { emoji: "🥛", label: "Lácteo" },
  huevo:    { emoji: "🥚", label: "Huevo" },
}

export interface MenuItem {
  id: string
  /** Round 9 · category drives the MenuModal tabs (Encebollados 3 ·
   *  Ceviches 2 · Otros 1 · Bebidas 6 · Extras 4 · 16 total). */
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
  /** R104 · foto real del plato · vive en `public/stories/` (esa carpeta
   *  guarda LA foto de cada plato · la usan tanto el carrusel "Fotos del
   *  menú" como las tarjetas de la carta · una sola copia por plato).
   *  Ausente = todavía no hay foto de ESE plato · cae a emoji+gradient.
   *  No se rellena con una foto parecida: una foto que no es el plato
   *  promete una cosa y sirve otra. */
  imageUrl?: string
  /** Display-only · emoji + gradient · es el RESPALDO cuando no hay
   *  `imageUrl`, no el estado normal. */
  emoji: string
  /** Tailwind gradient classes for the 2D thumbnail. */
  gradient: string
  /** R96.12 · allergens del plato · mostrados como badges en menu cards
   *  · cliente puede ver de un vistazo qué evitar antes de pedir. */
  allergens?: AllergenId[]
  /** R96.20 · modifiers opcionales · cliente toggle en el menu modal ·
   *  affect precio + persisten en CartLine.customizations. */
  modifiers?: MenuItemModifier[]
  /** R96.26 · ingredient toggles tri-state · cada uno tiene 3 estados
   *  (-1 sin · 0 normal default · +1 extra). Para ingredientes que
   *  vienen por default y cliente puede ajustar (cebolla · chifle · etc). */
  ingredientToggles?: MenuItemIngredientToggle[]
  /** R96.25 · variants static (data-driven) · obligatorio elegir 1 al
   *  agregar al cart. Mutuamente exclusivo con `dynamicVariantsKey`. */
  variants?: MenuItemVariant[]
  /** R96.25 · variants dinámicos · catálogo viene de Supabase tabla
   *  `naufrago_dynamic_options` por key. El local puede actualizar el
   *  catálogo día a día sin redeploy (jugos por sabor del día, etc.). */
  dynamicVariantsKey?: string
}

/** R96.26 · ingredient toggles compartidos · 3 ingredientes estándar
 *  de encebollados costa EC que el cliente típicamente quita o pide
 *  extra. Reutilizables across los 3 encebollados (Náufrago · Mixto ·
 *  Junior) + ceviches que comparten estos ingredientes. */
export const ENCEBOLLADO_TOGGLES: MenuItemIngredientToggle[] = [
  {
    id: "cebolla",
    label: "Cebolla",
    emoji: "🧅",
    removeLabel: "Sin cebolla",
    extraLabel: "+ Extra cebolla",
  },
  {
    id: "chifle",
    label: "Chifle",
    emoji: "🍌",
    removeLabel: "Sin chifle",
    extraLabel: "+ Extra chifle",
    extraPriceDelta: 0.5,
  },
  {
    id: "yerbita",
    label: "Yerbita",
    emoji: "🌿",
    removeLabel: "Sin yerbita",
    extraLabel: "+ Extra yerbita",
  },
]

export const CEVICHE_TOGGLES: MenuItemIngredientToggle[] = [
  {
    id: "cebolla",
    label: "Cebolla",
    emoji: "🧅",
    removeLabel: "Sin cebolla",
    extraLabel: "+ Extra cebolla",
  },
  {
    id: "chifle",
    label: "Chifle",
    emoji: "🍌",
    removeLabel: "Sin chifle",
    extraLabel: "+ Extra chifle",
    extraPriceDelta: 0.5,
  },
  {
    id: "mani",
    label: "Salsa de maní",
    emoji: "🥜",
    removeLabel: "Sin salsa de maní",
    extraLabel: "+ Extra salsa de maní",
  },
]

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
    imageUrl: "/stories/encebollado-naufrago.jpg",
    emoji: "🍲",
    gradient: "from-amber-700 via-amber-500 to-orange-400",
    allergens: ["pescado"],
    ingredientToggles: [
      ...ENCEBOLLADO_TOGGLES,
      { id: "pescado", label: "Pescado", emoji: "🐟", removeLabel: "Sin pescado", extraLabel: "+ 50g pescado adicional", extraPriceDelta: 1.5 },
      { id: "aguacate", label: "Aguacate", emoji: "🥑", extraLabel: "+ aguacate", extraPriceDelta: 1.0 },
      { id: "yuca", label: "Yuca", emoji: "🥔", removeLabel: "Sin yuca", extraLabel: "+ porción extra yuca", extraPriceDelta: 1.0 },
      { id: "pan", label: "Pan", emoji: "🍞", extraLabel: "+ pan adicional", extraPriceDelta: 0.5 },
      { id: "limon", label: "Limón", emoji: "🍋", extraLabel: "+ limón extra" },
    ],
  },
  {
    id: "encebollado-mixto",
    category: "encebollados",
    name: "Encebollado Mixto",
    description: "Encebollado con camarón y pescado.",
    ingredients: "Camarón · Pescado 100g · Yuca · Cebolla · Chifle o Pan",
    tags: [],
    priceUsd: 6.0,
    imageUrl: "/stories/encebollado-mixto.jpg",
    emoji: "🍲",
    gradient: "from-amber-700 via-orange-500 to-rose-400",
    allergens: ["pescado", "mariscos"],
    ingredientToggles: [
      ...ENCEBOLLADO_TOGGLES,
      { id: "pescado", label: "Pescado", emoji: "🐟", removeLabel: "Sin pescado", extraLabel: "+ 50g pescado adicional", extraPriceDelta: 1.5 },
      { id: "camaron", label: "Camarón adicional", emoji: "🦐", extraLabel: "+ camarón adicional", extraPriceDelta: 2.0 },
      { id: "aguacate", label: "Aguacate", emoji: "🥑", extraLabel: "+ aguacate", extraPriceDelta: 1.0 },
      { id: "yuca", label: "Yuca", emoji: "🥔", removeLabel: "Sin yuca", extraLabel: "+ porción extra yuca", extraPriceDelta: 1.0 },
      { id: "pan", label: "Pan", emoji: "🍞", extraLabel: "+ pan adicional", extraPriceDelta: 0.5 },
      { id: "limon", label: "Limón", emoji: "🍋", extraLabel: "+ limón extra" },
    ],
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
    allergens: ["pescado"],
    ingredientToggles: [
      ...ENCEBOLLADO_TOGGLES,
      { id: "pescado", label: "Pescado", emoji: "🐟", removeLabel: "Sin pescado", extraLabel: "+ 50g pescado adicional", extraPriceDelta: 1.5 },
      { id: "aguacate", label: "Aguacate", emoji: "🥑", extraLabel: "+ aguacate", extraPriceDelta: 1.0 },
      { id: "yuca", label: "Yuca", emoji: "🥔", removeLabel: "Sin yuca", extraLabel: "+ porción extra yuca", extraPriceDelta: 1.0 },
      { id: "pan", label: "Pan", emoji: "🍞", extraLabel: "+ pan adicional", extraPriceDelta: 0.5 },
      { id: "limon", label: "Limón", emoji: "🍋", extraLabel: "+ limón extra" },
    ],
  },

  // ── Ceviches (2) ──────────────────────────────────────────────────
  {
    id: "ceviche-naufrago",
    category: "ceviches",
    name: "Ceviche Náufrago",
    description: "Pescado curtido en leche de tigre · salsa de maní · aguacate.",
    ingredients:
      "Pescado curtido 200g · Leche de tigre · Aguacate · Salsa de maní · Chifle · Tomate cebolla pimiento",
    tags: [],
    priceUsd: 7.0,
    imageUrl: "/stories/ceviche-naufrago.jpg",
    emoji: "🐟",
    gradient: "from-cyan-600 via-emerald-500 to-lime-400",
    allergens: ["pescado", "mani"],
    ingredientToggles: [
      ...CEVICHE_TOGGLES,
      { id: "pescado", label: "Pescado", emoji: "🐟", removeLabel: "Sin pescado", extraLabel: "+ 50g pescado adicional", extraPriceDelta: 1.5 },
      { id: "aguacate", label: "Aguacate", emoji: "🥑", removeLabel: "Sin aguacate", extraLabel: "+ aguacate extra", extraPriceDelta: 1.0 },
      { id: "limon", label: "Limón", emoji: "🍋", extraLabel: "+ limón extra" },
    ],
  },
  {
    id: "ceviche-mixto",
    category: "ceviches",
    name: "Ceviche Mixto",
    description: "Pescado curtido en leche de tigre · salsa de maní · aguacate · + camarón.",
    ingredients:
      "Camarón · Pescado curtido 200g · Leche de tigre · Aguacate · Salsa de maní · Chifle · Tomate cebolla pimiento",
    tags: [],
    priceUsd: 9.0,
    imageUrl: "/stories/ceviche-mixto.jpg",
    emoji: "🦐",
    gradient: "from-emerald-600 via-cyan-500 to-sky-400",
    allergens: ["pescado", "mariscos", "mani"],
    ingredientToggles: [
      ...CEVICHE_TOGGLES,
      { id: "pescado", label: "Pescado", emoji: "🐟", removeLabel: "Sin pescado", extraLabel: "+ 50g pescado adicional", extraPriceDelta: 1.5 },
      { id: "camaron", label: "Camarón", emoji: "🦐", removeLabel: "Sin camarón", extraLabel: "+ doble camarón", extraPriceDelta: 2.0 },
      { id: "aguacate", label: "Aguacate", emoji: "🥑", removeLabel: "Sin aguacate", extraLabel: "+ aguacate extra", extraPriceDelta: 1.0 },
      { id: "limon", label: "Limón", emoji: "🍋", extraLabel: "+ limón extra" },
    ],
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
    allergens: ["lacteo", "huevo"],
    ingredientToggles: [
      { id: "huevo", label: "Huevo", emoji: "🥚", removeLabel: "Sin huevo", extraLabel: "+ Extra huevo", extraPriceDelta: 0.5 },
      { id: "queso", label: "Queso", emoji: "🧀", removeLabel: "Sin queso", extraLabel: "+ Extra queso", extraPriceDelta: 0.5 },
      { id: "aguacate", label: "Aguacate", emoji: "🥑", extraLabel: "+ aguacate", extraPriceDelta: 1.0 },
    ],
  },

  // ── Bebidas (6) ───────────────────────────────────────────────────
  {
    id: "jugo-natural",
    category: "bebidas",
    name: "Jugo natural del día",
    description: "Sabor del día · elegí cuando agregues.",
    tags: [],
    priceUsd: 2.0,
    imageUrl: "/stories/jugo-natural.jpg",
    emoji: "🍹",
    gradient: "from-orange-700 via-amber-500 to-yellow-300",
    // R96.25 · sabor del día varía · catálogo dinámico Supabase
    // tabla naufrago_dynamic_options key=juice_flavors. Local
    // actualiza diariamente sin redeploy.
    dynamicVariantsKey: "juice_flavors",
  },
  {
    id: "cola-grande",
    category: "bebidas",
    name: "Cola grande",
    description: "Elegí tu sabor preferido · 500ml.",
    tags: [],
    priceUsd: 2.0,
    emoji: "🥤",
    gradient: "from-rose-700 via-red-500 to-amber-400",
    // R96.25 · variants Coca-Cola brand · catálogo estable · NO dinámico.
    variants: [
      {
        id: "coca-cola",
        label: "Coca-Cola",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#E61A27", "#A01018", "#FFFFFF", "Coca-Cola"),
      },
      {
        id: "coca-cola-light",
        label: "Coca-Cola Light",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#1A1A1A", "#404040", "#E61A27", "Coca-Cola Light"),
      },
      {
        id: "sprite",
        label: "Sprite",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#0A8537", "#066624", "#FFE600", "Sprite"),
      },
      {
        id: "fanta",
        label: "Fanta",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#FF7A00", "#E55E00", "#FFFFFF", "Fanta"),
      },
      {
        id: "fiora",
        label: "Fiora",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#E91E63", "#AD1457", "#FFFFFF", "Fiora"),
      },
    ],
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
    allergens: ["gluten"],
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
    description: "Elegí tu sabor preferido · 350ml.",
    tags: [],
    priceUsd: 1.25,
    emoji: "🥤",
    gradient: "from-rose-600 via-red-500 to-amber-300",
    variants: [
      {
        id: "coca-cola",
        label: "Coca-Cola",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#E61A27", "#A01018", "#FFFFFF", "Coca-Cola"),
      },
      {
        id: "coca-cola-light",
        label: "Coca-Cola Light",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#1A1A1A", "#404040", "#E61A27", "Coca-Cola Light"),
      },
      {
        id: "sprite",
        label: "Sprite",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#0A8537", "#066624", "#FFE600", "Sprite"),
      },
      {
        id: "fanta",
        label: "Fanta",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#FF7A00", "#E55E00", "#FFFFFF", "Fanta"),
      },
      {
        id: "fiora",
        label: "Fiora",
        priceDelta: 0,
        imageUrl: brandBadgeUrl("#E91E63", "#AD1457", "#FFFFFF", "Fiora"),
      },
    ],
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
    allergens: ["gluten"],
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
    allergens: ["huevo"],
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
]

export const naufragoV2 = {
  hero: {
    /* Round 20 · hero slogan replace. Stored as plain text here so
       the metadata title (app/page.tsx) gets the new line. The
       visual h1 in LandingV2.tsx renders NÁUFRAGO inside a span
       with the brand cyan accent · keeping the headline as a flat
       string here means downstream consumers stay simple. */
    headline: "Cuando tengas esa hambre de... NÁUFRAGO te espera!",
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
  // Round 96 · `-compact` variants · gltf-transform pipeline ·
  // resize textures 2K máx + Draco geometry. Generated via
  // `scripts/compact-glbs.mjs`. Total before/after ·
  //   island       · 23.87 MB → 419 KB    (-98%)
  //   character    · 12.64 MB → 9.92 MB   (-23%)
  //   sign         · 15.83 MB → 2.72 MB   (-83%)
  //   surfboard    · 12.87 MB → 2.50 MB   (-81%)
  //   pergamino    · 26.7 MB  → 8.5 MB    (-68% · R84)
  // Originales sin tocar en el bucket · rollback = revertir URLs.
  island:    `${ASSET_BASE}/3d-models/island-low-poly-compact.glb`,
  character: `${ASSET_BASE}/3d-models/character-castaway-confused-scratch-compact.glb`,
  sign:      `${ASSET_BASE}/3d-models/sign-naufrago-compact.glb`,
  surfboard: `${ASSET_BASE}/3d-models/surfboard-old-compact.glb`,
  // Round 96.5 · props secundarios para la isla · Meshy AI ·
  // pipeline resize+draco compactado (atún 14→2 MB · cangrejo 30
  // →4 MB · botella 7→0.6 MB). Atún disponible pero no renderizado
  // todavía · pending decisión Emilio sobre placement.
  cangrejo:  `${ASSET_BASE}/3d-models/cangrejo-compact.glb`,
  botella:   `${ASSET_BASE}/3d-models/botella-compact.glb`,
  atun:      `${ASSET_BASE}/3d-models/atun-compact.glb`,
  // Pergamino pirata 3D asset (Meshy AI · Draco-compressed).
  pergamino: "/models/pergamino-pirata.glb",
  heroImage: `${ASSET_BASE}/v2/hero.png`,
} as const

// ── WhatsApp checkout template · spec-pinned ──────────────────────────
export const WHATSAPP_E164 = "593997744288"

export interface CartLine {
  id: string
  name: string
  priceUsd: number
  qty: number
  /** R96.11 · notas opcionales del cliente · "sin cilantro · alergias". */
  notes?: string
  /** R96.20 · modifiers seleccionados · cada uno con su priceDelta
   *  ya sumado al priceUsd. */
  customizations?: Array<{ id: string; label: string; priceDelta: number }>
}

export interface AppliedDiscountSummary {
  code: string
  percent: number
}

export function buildWhatsAppMessage(
  lines: CartLine[],
  discount?: AppliedDiscountSummary | null,
  tipUsd?: number,
): string {
  if (lines.length === 0) {
    return "Hola, quiero pedir."
  }
  const items = lines
    .map((l) => {
      const base = `• ${l.qty}× ${l.name} — $${(l.priceUsd * l.qty).toFixed(2)}`
      const extras: string[] = []
      if (l.customizations) {
        for (const c of l.customizations) extras.push(c.label)
      }
      if (l.notes) extras.push(l.notes)
      if (extras.length === 0) return base
      return `${base}\n${extras.map((e) => `    ↳ ${e}`).join("\n")}`
    })
    .join("\n")
  const subtotal = lines.reduce((s, l) => s + l.priceUsd * l.qty, 0)
  const tip = tipUsd && tipUsd > 0 ? tipUsd : 0
  const lines_msg = [
    "¡Hola Náufrago! Quiero pedir lo siguiente:",
    "",
    items,
    "",
  ]
  const hasDiscount = discount && discount.percent > 0
  const discountUsd = hasDiscount
    ? Math.round(subtotal * (discount!.percent / 100) * 100) / 100
    : 0
  const total = Math.max(0, subtotal - discountUsd + tip).toFixed(2)
  if (hasDiscount || tip > 0) {
    lines_msg.push(`Subtotal: $${subtotal.toFixed(2)}`)
    if (hasDiscount) {
      lines_msg.push(
        `Descuento (${discount!.code} · ${discount!.percent}%): −$${discountUsd.toFixed(2)}`,
      )
    }
    if (tip > 0) {
      lines_msg.push(`Propina motorizado: $${tip.toFixed(2)}`)
    }
    lines_msg.push(`Total: $${total}`)
  } else {
    lines_msg.push(`Total: $${subtotal.toFixed(2)}`)
  }
  lines_msg.push("", "¿Me confirmas tiempo de entrega? Gracias.")
  return lines_msg.join("\n")
}

export function buildWhatsAppLink(
  lines: CartLine[],
  discount?: AppliedDiscountSummary | null,
  tipUsd?: number,
): string {
  const msg = buildWhatsAppMessage(lines, discount, tipUsd)
  return `https://wa.me/${WHATSAPP_E164}?text=${encodeURIComponent(msg)}`
}
