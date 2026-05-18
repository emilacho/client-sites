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

/* Round 77 · discount codes from the treasure-chest reveal.
 * Currently a single hard-coded code worth 5% off the cart subtotal.
 * Easy to expand into a server-validated table later. */
const DISCOUNT_CODES: Record<string, { percent: number; label: string }> = {
  NAUFRAGO5: { percent: 5, label: "Tesoro · 5% OFF" },
}

export interface CartLine {
  id: string
  name: string
  priceUsd: number
  qty: number
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
  /** subtotal − discountUsd. */
  total: number
  itemCount: number
  add: (line: Omit<CartLine, "qty">, qty?: number) => void
  remove: (id: string) => void
  setQty: (id: string, qty: number) => void
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
}

const Ctx = createContext<CartCtx | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
  const [discount, setDiscount] = useState<AppliedDiscount | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

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

  const clear = useCallback(() => setLines([]), [])

  const applyCode = useCallback((code: string) => {
    const key = code.trim().toUpperCase()
    const entry = DISCOUNT_CODES[key]
    if (!entry) return false
    setDiscount({ code: key, percent: entry.percent, label: entry.label })
    return true
  }, [])

  const removeDiscount = useCallback(() => setDiscount(null), [])

  const value = useMemo<CartCtx>(() => {
    const subtotal = lines.reduce((s, l) => s + l.priceUsd * l.qty, 0)
    const itemCount = lines.reduce((s, l) => s + l.qty, 0)
    const discountUsd = discount
      ? Math.round(subtotal * (discount.percent / 100) * 100) / 100
      : 0
    const total = Math.max(0, subtotal - discountUsd)
    return {
      lines,
      subtotal,
      discountUsd,
      total,
      itemCount,
      add,
      remove,
      setQty,
      clear,
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      toggle: () => setIsOpen((v) => !v),
      discount,
      applyCode,
      removeDiscount,
    }
  }, [lines, isOpen, discount, add, remove, setQty, clear, applyCode, removeDiscount])

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
