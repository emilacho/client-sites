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

export interface CartLine {
  id: string
  name: string
  priceUsd: number
  qty: number
}

interface CartCtx {
  lines: CartLine[]
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
}

const Ctx = createContext<CartCtx | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([])
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

  const value = useMemo<CartCtx>(() => {
    const total = lines.reduce((s, l) => s + l.priceUsd * l.qty, 0)
    const itemCount = lines.reduce((s, l) => s + l.qty, 0)
    return {
      lines,
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
    }
  }, [lines, isOpen, add, remove, setQty, clear])

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
