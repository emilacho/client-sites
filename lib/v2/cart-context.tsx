"use client"
/**
 * Cart context · localStorage `naufrago_cart_v1` schema.
 *
 * Persists across reloads · hydration-safe (initial render = empty,
 * `useEffect` populates from localStorage). Exposed via `useCart()`
 * to any descendant client component.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

const STORAGE_KEY = "naufrago_cart_v1"
const DISCOUNT_KEY = "naufrago_discount_v1"

// R96.104 · premios de la ruleta NO son acumulativos · si pasan más
// de 24h sin consumir → se borran del carrito en la hidratación.
// Evita que un usuario acumule "40 chifles" entre días.
const PRIZE_TS_KEY = "naufrago_prize_added_at"
const PRIZE_LINE_IDS = ["prize-chifle", "prize-pan", "prize-cola"]
const PRIZE_RESET_HOURS = 24

/* Round 77 · discount codes from the treasure-chest reveal.
 * Round 87 · code rebrand · NAUFRAGO5 retired in favor of
 * SurfBollado (mixed-case display, uppercase lookup key).
 * Single hard-coded code worth 5% off the cart subtotal. */
const DISCOUNT_CODES: Record<string, { percent: number; label: string }> = {
  SURFBOLLADO: { percent: 5, label: "Tesoro de Náufrago · 5% OFF" },
}

export interface CartLine {
  id: string
  name: string
  priceUsd: number
  qty: number
  /** Round 96.11 · notas opcionales por ítem · "sin cilantro · alergia
   *  al maní · poco picante". Visible al motorizado + cocina. */
  notes?: string
  /** R96.20 · modifiers seleccionados · array de labels procesados
   *  ya con priceDelta sumado al priceUsd resuelto. Visibles al
   *  cocinero igual que las notas. */
  customizations?: Array<{ id: string; label: string; priceDelta: number }>
}

export interface AppliedDiscount {
  code: string
  percent: number
  label: string
}

interface CartCtx {
  lines: CartLine[]
  /** Sum of line price × qty BEFORE discount. */
  subtotal: number
  /** Active discount amount in USD (rounded to 2 decimals). */
  discountUsd: number
  /** R96.15 · propina al motorizado (USD · 0 si no aplica). */
  tipUsd: number
  /** subtotal − discountUsd + tipUsd. */
  total: number
  itemCount: number
  add: (line: Omit<CartLine, "qty">, qty?: number) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
  /** R96.11 · update notes opcionales para una línea. */
  setNotes: (id: string, notes: string) => void
  clear: () => void
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /** Currently applied discount · null when none. */
  discount: AppliedDiscount | null
  /** Try to apply a code. Returns true on success. */
  applyCode: (code: string) => boolean
  removeDiscount: () => void
  /** R96.15 · setter para tipUsd · maps a discrete chip or custom value. */
  setTip: (usd: number) => void
}

const Ctx = createContext<CartCtx | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null)
  const [tipUsd, setTipUsdState] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const setTip = useCallback((usd: number) => {
    if (!Number.isFinite(usd) || usd < 0) {
      setTipUsdState(0)
      return
    }
    setTipUsdState(Math.round(usd * 100) / 100)
  }, [])

  // Hydrate from localStorage on mount
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setLines(parsed.filter(isLine))
      }
    } catch {
      // ignore quota / parse errors · start with empty cart
    }
    try {
      const rawD = window.localStorage.getItem(DISCOUNT_KEY)
      if (rawD) {
        const parsedD = JSON.parse(rawD) as Partial<AppliedDiscount>
        if (
          parsedD &&
          typeof parsedD.code === "string" &&
          typeof parsedD.percent === "number"
        ) {
          // Re-validate against the current DISCOUNT_CODES table ·
          // a stored code that's been removed from the table won't
          // rehydrate.
          const entry = DISCOUNT_CODES[parsedD.code.toUpperCase()]
          if (entry) {
            setDiscount({
              code: parsedD.code.toUpperCase(),
              percent: entry.percent,
              label: entry.label,
            })
          }
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true)
  }, [])

  // R96.104 · cleanup premios vencidos (>24h sin consumir) post-hidratación.
  // Si pasaron >=24h desde que se agregó · se barren las líneas prize-* del
  // carrito. Evita acumulación entre días.
  useEffect(() => {
    if (!hydrated) return
    try {
      const ts = window.localStorage.getItem(PRIZE_TS_KEY)
      if (!ts) return
      const ageHours = (Date.now() - Number(ts)) / 3600_000
      if (ageHours >= PRIZE_RESET_HOURS) {
        setLines((prev) =>
          prev.filter((l) => !PRIZE_LINE_IDS.includes(l.id)),
        )
        window.localStorage.removeItem(PRIZE_TS_KEY)
      }
    } catch {
      // ignore
    }
  }, [hydrated])

  // Persist whenever lines change (post-hydration only)
  useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
    } catch {
      // ignore
    }
  }, [lines, hydrated])

  // Persist discount independently · survives cart clears so the
  // customer doesn't lose the code if they remove a single item.
  useEffect(() => {
    if (!hydrated) return
    try {
      if (discount) {
        window.localStorage.setItem(DISCOUNT_KEY, JSON.stringify(discount))
      } else {
        window.localStorage.removeItem(DISCOUNT_KEY)
      }
    } catch {
      // ignore
    }
  }, [discount, hydrated])

  const add = useCallback((line: Omit<CartLine, "qty">, qty = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.id === line.id)
      if (existing) {
        return prev.map((l) =>
          l.id === line.id ? { ...l, qty: l.qty + qty } : l,
        )
      }
      return [...prev, { ...line, qty }]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setLines((prev) => prev.filter((l) => l.id !== id))
  }, [])

  const setQty = useCallback((id: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.id !== id)
      return prev.map((l) => (l.id === id ? { ...l, qty } : l))
    })
  }, [])

  const setNotes = useCallback((id: string, notes: string) => {
    setLines((prev) =>
      prev.map((l) =>
        l.id === id ? { ...l, notes: notes.trim() || undefined } : l,
      ),
    )
  }, [])

  const clear = useCallback(() => {
    setLines([])
    setTipUsdState(0)
  }, [])

  const applyCode = useCallback((code: string) => {
    // Round 87 · preserve the user-typed casing for display
    // (e.g. "SurfBollado" stays mixed-case in the chip) while
    // looking up the dictionary entry case-insensitively.
    const trimmed = code.trim()
    const key = trimmed.toUpperCase()
    const entry = DISCOUNT_CODES[key]
    if (!entry) return false
    setDiscount({ code: trimmed, percent: entry.percent, label: entry.label })
    return true
  }, [])

  const removeDiscount = useCallback(() => setDiscount(null), [])

  const value = useMemo<CartCtx>(() => {
    const subtotal = lines.reduce((s, l) => s + l.priceUsd * l.qty, 0)
    const itemCount = lines.reduce((s, l) => s + l.qty, 0)
    const discountUsd = discount
      ? Math.round(subtotal * (discount.percent / 100) * 100) / 100
      : 0
    const total = Math.max(0, subtotal - discountUsd + tipUsd)
    return {
      lines,
      subtotal,
      discountUsd,
      tipUsd,
      total,
      itemCount,
      add,
      remove,
      setQty,
      setNotes,
      clear,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      discount,
      applyCode,
      removeDiscount,
      setTip,
    }
  }, [lines, isOpen, discount, tipUsd, add, remove, setQty, setNotes, clear, applyCode, removeDiscount, setTip])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart(): CartCtx {
  const v = useContext(Ctx)
  if (!v) {
    throw new Error("useCart must be used inside <CartProvider>")
  }
  return v
}

function isLine(x: unknown): x is CartLine {
  if (!x || typeof x !== "object") return false
  const o = x as Record<string, unknown>
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.priceUsd === "number" &&
    typeof o.qty === "number"
  )
}
