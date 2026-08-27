import { MENU_ITEMS, type MenuItem } from "@/lib/v2/naufrago-content"

/**
 * Búsqueda fuzzy del menú para el assistant de voz · R97.3 Fase 2.
 *
 * Cliente dice "quiero un encebollado mixto" → searchMenu("encebollado mixto")
 * → devuelve el MenuItem con id "encebollado-mixto" + score. El LLM usa la
 * respuesta para confirmar la opción al cliente.
 */

export interface MenuSearchResult {
  id: string
  name: string
  subtitle?: string
  category: string
  ingredients?: string
  priceUsd: number
  allergens?: string[]
  /** Modifiers disponibles · expuestos al LLM para que pueda capturar
   *  preferencias dichas oralmente ("sin cebolla" · "extra camarón"). */
  toggles?: Array<{
    id: string
    label: string
    canRemove: boolean
    canAddExtra: boolean
    extraPriceDelta: number
  }>
  /** Variants si aplica · ej bebidas brand · jugos sabor del día. */
  variants?: Array<{ id: string; label: string; priceDelta: number }>
  dynamicVariantsKey?: string
  /** Score 0-100 · 100 = match perfecto · 0 = no match. */
  score: number
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function scoreItem(item: MenuItem, query: string): number {
  const q = normalize(query)
  if (!q) return 0
  const name = normalize(item.name)
  const ingredients = normalize(item.ingredients ?? "")
  const description = normalize(item.description ?? "")
  const subtitle = normalize(item.subtitle ?? "")
  const id = normalize(item.id.replace(/-/g, " "))

  if (name === q) return 100
  if (id === q) return 95
  if (name.includes(q)) return 90
  if (id.includes(q)) return 85
  if (subtitle && subtitle.includes(q)) return 80

  // Token overlap · % de tokens del query que aparecen en name + ingredients
  const tokens = q.split(/\s+/).filter((t) => t.length >= 2)
  if (tokens.length === 0) return 0
  const haystack = `${name} ${ingredients} ${description} ${subtitle} ${id}`
  let matched = 0
  for (const t of tokens) {
    if (haystack.includes(t)) matched++
  }
  const ratio = matched / tokens.length
  if (ratio === 0) return 0
  return Math.round(40 + ratio * 50)
}

function toResult(item: MenuItem, score: number): MenuSearchResult {
  return {
    id: item.id,
    name: item.name,
    subtitle: item.subtitle,
    category: item.category,
    ingredients: item.ingredients,
    priceUsd: item.priceUsd,
    allergens: item.allergens,
    toggles: item.ingredientToggles?.map((t) => ({
      id: t.id,
      label: t.label,
      canRemove: Boolean(t.removeLabel),
      canAddExtra: true,
      extraPriceDelta: t.extraPriceDelta ?? 0,
    })),
    variants: item.variants?.map((v) => ({
      id: v.id,
      label: v.label,
      priceDelta: v.priceDelta,
    })),
    dynamicVariantsKey: item.dynamicVariantsKey,
    score,
  }
}

/** Búsqueda principal · devuelve top N items con score > threshold. */
export function searchMenu(query: string, limit = 5): MenuSearchResult[] {
  const scored = MENU_ITEMS.map((item) => ({
    item,
    score: scoreItem(item, query),
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
  return scored.map((s) => toResult(s.item, s.score))
}

/** Lookup directo por id · usado por add_to_cart después que el LLM
 *  decidió cuál ítem agregar. */
export function getMenuItemById(id: string): MenuSearchResult | null {
  const item = MENU_ITEMS.find((i) => i.id === id)
  return item ? toResult(item, 100) : null
}

/** Lista resumida de TODAS las categorías + ids · útil cuando el cliente
 *  pregunta abierto "qué tienen" sin specifics. */
export function summarizeMenu(): Array<{
  category: string
  items: Array<{ id: string; name: string; priceUsd: number }>
}> {
  const byCategory = new Map<string, Array<{ id: string; name: string; priceUsd: number }>>()
  for (const item of MENU_ITEMS) {
    const list = byCategory.get(item.category) ?? []
    list.push({ id: item.id, name: item.name, priceUsd: item.priceUsd })
    byCategory.set(item.category, list)
  }
  return Array.from(byCategory.entries()).map(([category, items]) => ({
    category,
    items,
  }))
}
