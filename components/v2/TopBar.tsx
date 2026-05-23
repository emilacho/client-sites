"use client"
/**
 * TopBar · floating brand + cart-trigger bar.
 *
 * Pinned at the top with backdrop blur, transparent until scrolled.
 * Brand mark on the left · cart button (with count badge) on the right.
 * No nav · the 3D anchors handle navigation.
 */
import { Loader2, MapPin, ShoppingCart } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"
import { useUserLocation } from "@/lib/v2/use-user-location"
import { cliente } from "@/cliente.config"

export function TopBar() {
  const cart = useCart()
  const { state: locState, label: locLabel } = useUserLocation()
  const showLocation = locState === "ready" && !!locLabel
  const showSpinner = locState === "asking" || locState === "loading"

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 md:px-6 md:pt-4">
      <div className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between rounded-full border border-slate-800/80 bg-slate-950/65 px-4 py-2 backdrop-blur-xl md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
          {showLocation ? (
            <>
              <MapPin
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 text-cyan-300 drop-shadow-[0_0_6px_rgba(77,212,216,0.5)]"
              />
              <span
                className="truncate font-display text-sm font-semibold tracking-tight text-slate-100"
                title={locLabel ?? undefined}
              >
                {locLabel}
              </span>
            </>
          ) : showSpinner ? (
            <>
              <Loader2
                aria-hidden
                className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400"
              />
              <span className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300">
                detectando ubicación…
              </span>
            </>
          ) : (
            <>
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 shadow-[0_0_10px_rgba(124,58,237,0.7)]"
              />
              <span className="truncate font-display text-sm font-semibold tracking-tight text-slate-100">
                {cliente.name}
              </span>
              <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/80 md:inline">
                · ghost kitchen Olón
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={cart.open}
          className="relative inline-flex items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-100 transition-colors hover:bg-violet-500/20"
          aria-label="Abrir carrito"
        >
          {/* Round 14 single-issue fix · removed
              `<span className="hidden md:inline">Carrito</span>`
              The icon + aria-label="Abrir carrito" already carries the
              affordance · the literal text was redundant once the
              shopping-cart pictogram is recognized, and pushed the
              hero CTA cluster wider than necessary on md+. */}
          <ShoppingCart className="h-4 w-4" />
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
