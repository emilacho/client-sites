"use client"
/**
 * MenuModal · 17-item catalog opened from the cofre anchor.
 *
 *  - 5 tabs (Encebollados · Ceviches · Otros · Bebidas · Extras) with
 *    item counts driven from MENU_ITEMS · order is canonical (3 · 2 ·
 *    1 · 6 · 5 · pinned in naufrago-content.ts).
 *  - Card grid · each card has emoji thumbnail, name, description,
 *    ingredients line, price, and a "+ Agregar" button that calls
 *    `cart.add({ id, name, priceUsd })` and flashes "Agregado" for
 *    1.2s so the user gets visual confirmation without leaving the
 *    modal.
 *  - Dismiss · backdrop click, ESC key, or the close (×) button.
 *  - "Confirmar por WhatsApp" CTA at the bottom · opens the cart
 *    drawer (which holds the actual WA checkout link) only if the
 *    cart has lines.
 *  - Framer Motion AnimatePresence for backdrop + panel reveal · the
 *    panel respects `prefers-reduced-motion` via the framer config.
 *
 * Round 9 · single-issue commit · wires the cofre click to a real
 * 17-item catalog. Cart drawer + TopBar + scene anchors are
 * untouched (same diff). Future rounds will polish water/sky/bloom.
 */
import { useCallback, useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { useCart } from "@/lib/v2/cart-context"
import {
  MENU_ITEMS,
  MENU_CATEGORIES,
  type MenuCategoryId,
  type MenuItem,
} from "@/lib/v2/naufrago-content"

export interface MenuModalProps {
  open: boolean
  onClose: () => void
}

export function MenuModal({ open, onClose }: MenuModalProps) {
  const [activeCat, setActiveCat] = useState<MenuCategoryId>("encebollados")
  const cart = useCart()

  // ESC closes the modal · only attached while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  const handleConfirm = useCallback(() => {
    if (cart.itemCount === 0) return
    onClose()
    cart.open()
  }, [cart, onClose])

  const itemsByCat = MENU_ITEMS.filter((i) => i.category === activeCat)

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="menu-modal-root"
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          role="dialog"
          aria-modal="true"
          aria-label="Menú de Náufrago"
        >
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Panel */}
          <motion.div
            initial={{ y: "8%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "8%", opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.2, 0.8, 0.2, 1] }}
            className="relative z-10 flex max-h-[92svh] w-full max-w-3xl flex-col overflow-hidden rounded-t-3xl border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl shadow-violet-500/10 md:rounded-3xl"
          >
            {/* Header */}
            <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-6 py-5">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200">
                  Menú · 17 platos
                </span>
                <h2 className="mt-1 font-display text-2xl font-semibold leading-tight text-white md:text-3xl">
                  Pide lo que quieras · cocinamos al momento
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-800"
              >
                ×
              </button>
            </header>

            {/* Tabs */}
            <nav
              role="tablist"
              aria-label="Categorías de menú"
              className="flex gap-2 overflow-x-auto border-b border-slate-800 px-4 py-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {MENU_CATEGORIES.map((cat) => {
                const count = MENU_ITEMS.filter((i) => i.category === cat.id).length
                const isActive = cat.id === activeCat
                return (
                  <button
                    key={cat.id}
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveCat(cat.id)}
                    className={
                      "inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
                      (isActive
                        ? "border-cyan-400/60 bg-cyan-500/15 text-cyan-100"
                        : "border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800")
                    }
                  >
                    <span aria-hidden>{cat.emoji}</span>
                    <span>{cat.label}</span>
                    <span
                      className={
                        "ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-mono " +
                        (isActive
                          ? "bg-cyan-400/20 text-cyan-100"
                          : "bg-slate-800 text-slate-400")
                      }
                    >
                      {count}
                    </span>
                  </button>
                )
              })}
            </nav>

            {/* Grid · scrollable area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {itemsByCat.map((item) => (
                  <MenuCard key={item.id} item={item} />
                ))}
              </div>
            </div>

            {/* Footer · Confirmar por WhatsApp */}
            <footer className="flex items-center justify-between gap-3 border-t border-slate-800 bg-slate-950/95 px-5 py-4">
              <div className="text-sm">
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Tu pedido
                </span>
                <div className="mt-0.5 font-semibold text-white">
                  {cart.itemCount} {cart.itemCount === 1 ? "ítem" : "ítems"} · $
                  {cart.total.toFixed(2)}
                </div>
              </div>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={cart.itemCount === 0}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 font-semibold text-white shadow-lg shadow-emerald-500/30 transition-transform hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:from-slate-700 disabled:to-slate-700 disabled:text-slate-400 disabled:shadow-none disabled:hover:translate-y-0"
              >
                Confirmar por WhatsApp
              </button>
            </footer>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function MenuCard({ item }: { item: MenuItem }) {
  const cart = useCart()
  const [flash, setFlash] = useState(false)

  const handleAdd = () => {
    cart.add({ id: item.id, name: item.name, priceUsd: item.priceUsd })
    setFlash(true)
    window.setTimeout(() => setFlash(false), 1200)
  }

  return (
    <article className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3 transition-colors hover:bg-slate-900">
      <div
        aria-hidden
        className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} text-3xl shadow-inner`}
      >
        <span>{item.emoji}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display text-base font-semibold text-white">
            {item.name}
          </h3>
          <span className="shrink-0 font-mono text-sm font-semibold text-cyan-200">
            ${item.priceUsd.toFixed(2)}
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-slate-300">
          {item.description}
        </p>
        {item.ingredients && (
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-400">
            {item.ingredients}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
              >
                {t}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={handleAdd}
            aria-label={`Agregar ${item.name}`}
            className={
              "inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors " +
              (flash
                ? "bg-emerald-500 text-white"
                : "bg-slate-800 text-slate-100 hover:bg-slate-700")
            }
          >
            {flash ? "✓ Agregado" : "+ Agregar"}
          </button>
        </div>
      </div>
    </article>
  )
}
