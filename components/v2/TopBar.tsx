"use client"
/**
 * TopBar · floating brand + cart-trigger bar.
 *
 * Pinned at the top with backdrop blur, transparent until scrolled.
 * Brand mark on the left · cart button (with count badge) on the right.
 * No nav · the 3D anchors handle navigation.
 */
import { ShoppingCart } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"
import { cliente } from "@/cliente.config"

export function TopBar() {
  const cart = useCart()
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 md:px-6 md:pt-4">
      <div className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between rounded-full border border-slate-800/80 bg-slate-950/65 px-4 py-2 backdrop-blur-xl md:px-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 shadow-[0_0_10px_rgba(124,58,237,0.7)]"
          />
          <span className="font-display text-sm font-semibold tracking-tight text-slate-100">
            {cliente.name}
          </span>
          <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/80 md:inline">
            · ghost kitchen Olón
          </span>
        </div>
        <button
          type="button"
          onClick={cart.open}
          className="relative inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-100 transition-colors hover:bg-violet-500/20"
          aria-label="Abrir carrito"
        >
          <ShoppingCart className="h-4 w-4" />
          <span className="hidden md:inline">Carrito</span>
          {cart.itemCount > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cyan-500 px-1.5 text-[10.5px] font-bold text-slate-950 tabular-nums shadow-md">
              {cart.itemCount}
            </span>
          ) : null}
        </button>
      </div>
    </header>
  )
}
