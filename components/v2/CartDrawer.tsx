"use client"
/**
 * CartDrawer · responsive cart surface.
 *
 *  - desktop · slide-in from the right (Radix Dialog · framer-motion)
 *  - mobile  · bottom-sheet drawer (`<md` viewport)
 *
 * Amazon-style line items with 2D thumbnail (gradient + emoji until
 * real food photography lands in Storage). Checkout button opens
 * `https://wa.me/593997744288?text=...` with the spec template.
 */
import { useEffect, useState } from "react"
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react"
// useState imported above is reused by the DiscountCodeRow helper.
import { motion, AnimatePresence } from "framer-motion"
import { useCart } from "@/lib/v2/cart-context"
import { buildWhatsAppLink, naufragoV2 } from "@/lib/v2/naufrago-content"
import { CourierQuoteFlow } from "./CourierQuoteFlow"

function MenuThumb({ id, emoji }: { id: string; emoji: string }) {
  const item = naufragoV2.menu.find((m) => m.id === id)
  const gradient = item?.gradient ?? "from-slate-700 to-slate-900"
  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${gradient} text-2xl shadow-inner ring-1 ring-white/20`}
      aria-hidden
    >
      {emoji}
    </div>
  )
}

export function CartDrawer() {
  const cart = useCart()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    setIsMobile(mq.matches)
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", h)
    return () => mq.removeEventListener("change", h)
  }, [])

  return (
    <AnimatePresence>
      {cart.isOpen ? (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={cart.close}
            className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm"
          />
          {/* Panel · slide-in right on md+ · bottom-sheet on mobile */}
          <motion.aside
            key="panel"
            role="dialog"
            aria-label="Tu carrito"
            initial={isMobile ? { y: "100%" } : { x: "100%" }}
            animate={isMobile ? { y: 0 } : { x: 0 }}
            exit={isMobile ? { y: "100%" } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className={[
              "fixed z-50 flex flex-col bg-slate-950/95 text-slate-100 shadow-2xl backdrop-blur-xl",
              "border-violet-500/20",
              isMobile
                ? "inset-x-0 bottom-0 max-h-[85vh] rounded-t-2xl border-t-2"
                : "inset-y-0 right-0 w-full max-w-md border-l-2",
            ].join(" ")}
          >
            {/* Mobile grip handle */}
            {isMobile ? (
              <div className="flex justify-center pt-2 pb-1">
                <span className="h-1.5 w-12 rounded-full bg-slate-700" />
              </div>
            ) : null}

            {/* Header */}
            <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-cyan-300" />
                <h2 className="text-base font-semibold tracking-tight">Tu pedido</h2>
                {cart.itemCount > 0 ? (
                  <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-500/20 px-1.5 text-[11px] font-mono text-violet-200 tabular-nums">
                    {cart.itemCount}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={cart.close}
                aria-label="Cerrar carrito"
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              {cart.lines.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="flex flex-col gap-3">
                  {cart.lines.map((line) => {
                    const item = naufragoV2.menu.find((m) => m.id === line.id)
                    return (
                      <li
                        key={line.id}
                        className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3"
                      >
                        <MenuThumb id={line.id} emoji={item?.emoji ?? "🍽"} />
                        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="font-medium leading-tight">{line.name}</span>
                            <span className="font-mono text-sm tabular-nums text-cyan-200">
                              ${(line.priceUsd * line.qty).toFixed(2)}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            ${line.priceUsd.toFixed(2)} c/u
                          </span>
                          <div className="mt-1 flex items-center justify-between">
                            <div className="inline-flex items-center rounded-full border border-slate-700 bg-slate-950">
                              <button
                                type="button"
                                onClick={() => cart.setQty(line.id, line.qty - 1)}
                                aria-label="Quitar uno"
                                className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-[24px] text-center font-mono text-sm tabular-nums">
                                {line.qty}
                              </span>
                              <button
                                type="button"
                                onClick={() => cart.setQty(line.id, line.qty + 1)}
                                aria-label="Agregar uno"
                                className="rounded-full p-1.5 text-slate-300 transition-colors hover:bg-slate-800 hover:text-slate-100"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => cart.remove(line.id)}
                              className="inline-flex items-center gap-1 text-[11px] text-rose-300/80 hover:text-rose-200"
                            >
                              <Trash2 className="h-3 w-3" /> Quitar
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {/* Footer · totals + discount + checkout */}
            <footer className="border-t border-slate-800 bg-slate-950/80 px-5 py-4">
              {/* Round 77 · discount surface · code input visible
                  when no code is active · applied chip + remove
                  when one is. */}
              <DiscountCodeRow />

              {/* Subtotal + discount line + total breakdown.
                  When no discount is active, subtotal === total and
                  the discount line is hidden · the row count
                  collapses to a single line like before. */}
              {cart.discountUsd > 0 ? (
                <div className="mb-3 space-y-1">
                  <div className="flex items-baseline justify-between text-xs text-slate-400">
                    <span>Subtotal</span>
                    <span className="tabular-nums">${cart.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs" style={{ color: "#4DD4D8" }}>
                    <span>Descuento · {cart.discount?.code}</span>
                    <span className="tabular-nums">−${cart.discountUsd.toFixed(2)}</span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-sm text-slate-300">Total</span>
                    <span className="font-display text-xl font-semibold tabular-nums text-cyan-200">
                      ${cart.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="mb-3 flex items-baseline justify-between">
                  <span className="text-sm text-slate-400">Total</span>
                  <span className="font-display text-xl font-semibold tabular-nums text-cyan-200">
                    ${cart.total.toFixed(2)}
                  </span>
                </div>
              )}
              {/* Round 74 · PedidosYa Courier integration · sits
                  between the total and the WhatsApp CTA. Renders
                  nothing when the cart is empty. */}
              <CourierQuoteFlow />
              <a
                href={buildWhatsAppLink(cart.lines, cart.discount)}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={cart.lines.length === 0}
                className={[
                  "flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-semibold transition-all",
                  cart.lines.length === 0
                    ? "pointer-events-none bg-slate-800 text-slate-500"
                    : "bg-gradient-to-r from-violet-500 to-cyan-500 text-white shadow-lg shadow-violet-500/30 hover:translate-y-[-1px] hover:shadow-violet-500/50",
                ].join(" ")}
              >
                Confirmar por WhatsApp
              </a>
              <p className="mt-2 text-center text-[11px] text-slate-500">
                Te confirmamos tiempo de entrega en el chat · pagas al recibir.
              </p>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-800 text-2xl">
        🛒
      </div>
      <p className="text-sm text-slate-300">Tu carrito está vacío.</p>
      <p className="text-[12px] text-slate-500">
        Toca el <strong className="text-cyan-300">cofre</strong> en la isla
        para reclamar tu descuento, luego explorá el menú.
      </p>
    </div>
  )
}

/* Round 77 · standalone discount row above the totals · two states:
 *   - no discount · text input + "Aplicar" button · invalid input
 *     shakes and shows a brief "código inválido" hint
 *   - active discount · chip with the code + label + remove button
 */
function DiscountCodeRow() {
  const cart = useCart()
  const [code, setCode] = useState("")
  const [error, setError] = useState(false)

  if (cart.discount) {
    return (
      <div
        className="mb-3 flex items-center justify-between rounded-xl border px-3 py-2"
        style={{
          borderColor: "rgba(77,212,216,0.5)",
          background: "rgba(76,29,149,0.18)",
        }}
      >
        <div>
          <div
            className="font-mono text-[10px] uppercase tracking-[0.22em]"
            style={{ color: "#4DD4D8" }}
          >
            Código aplicado
          </div>
          <div className="text-sm font-semibold text-slate-100">
            {cart.discount.code}{" "}
            <span className="font-normal text-slate-400">
              · {cart.discount.label}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => cart.removeDiscount()}
          aria-label="Quitar código"
          className="rounded-full p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const ok = cart.applyCode(code)
        if (!ok) {
          setError(true)
          setTimeout(() => setError(false), 1400)
        } else {
          setCode("")
        }
      }}
      className="mb-3 flex gap-2"
    >
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="¿Tenés un código?"
        className={[
          "flex-1 rounded-md border bg-slate-950 px-3 py-2 text-sm uppercase tracking-[0.1em] text-slate-100 placeholder:text-slate-500 transition-all",
          error
            ? "border-rose-500 ring-1 ring-rose-500/40"
            : "border-slate-700 focus:border-cyan-500",
        ].join(" ")}
        maxLength={20}
      />
      <button
        type="submit"
        disabled={!code.trim()}
        className="rounded-md bg-gradient-to-r from-violet-500 to-cyan-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        Aplicar
      </button>
    </form>
  )
}
