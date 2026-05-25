"use client"
/**
 * TopBar · floating brand/location + cart-trigger bar.
 *
 * Layout (left-to-right) ·
 *   [dot/MapPin] [LOCATION or NÁUFRAGO] [· GHOST KITCHEN OLÓN]   [cart]
 *
 * The leading label swaps with a 350ms fade when the browser
 * geolocation resolves (cliente.name fallback when denied · loading
 * spinner while in-flight). The "· ghost kitchen Olón" sublabel
 * stays pinned · it's the brand anchor regardless of user location.
 */
import { AnimatePresence, motion } from "framer-motion"
import { Loader2, MapPin, User } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"
import { useUserLocation } from "@/lib/v2/use-user-location"
import { useBusinessHours } from "@/lib/v2/use-business-hours"
import { useAccount } from "@/lib/v2/use-account"
import { cliente } from "@/cliente.config"
import { CanoeIcon } from "./CanoeIcon"

interface TopBarProps {
  onOpenAccount?: () => void
}

export function TopBar({ onOpenAccount }: TopBarProps = {}) {
  const cart = useCart()
  const { state: locState, label: locLabel } = useUserLocation()
  const hours = useBusinessHours()
  const { account } = useAccount()
  const showLocation = locState === "ready" && !!locLabel
  const showSpinner = locState === "asking" || locState === "loading"

  const variant: "location" | "spinner" | "brand" = showLocation
    ? "location"
    : showSpinner
      ? "spinner"
      : "brand"

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 md:px-6 md:pt-4">
      <div className="pointer-events-auto mx-auto flex max-w-6xl items-center justify-between rounded-full border border-slate-800/80 bg-slate-950/65 px-4 py-2 backdrop-blur-xl md:px-5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 pr-3">
          <AnimatePresence mode="wait" initial={false}>
            {variant === "location" ? (
              <motion.div
                key="loc"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex min-w-0 items-center gap-2.5"
              >
                <MapPin
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 text-cyan-300 drop-shadow-[0_0_6px_rgba(77,212,216,0.55)]"
                />
                <span
                  className="truncate font-display text-sm font-semibold tracking-tight text-slate-100"
                  title={locLabel ?? undefined}
                >
                  {locLabel}
                </span>
              </motion.div>
            ) : variant === "spinner" ? (
              <motion.div
                key="spin"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="flex min-w-0 items-center gap-2.5"
              >
                <Loader2
                  aria-hidden
                  className="h-3.5 w-3.5 shrink-0 animate-spin text-slate-400"
                />
                <span className="truncate font-mono text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  detectando ubicación…
                </span>
              </motion.div>
            ) : (
              <motion.div
                key="brand"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.35, ease: "easeOut" }}
                className="flex min-w-0 items-center gap-2.5"
              >
                <span
                  aria-hidden
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 shadow-[0_0_10px_rgba(124,58,237,0.7)]"
                />
                <span className="truncate font-display text-sm font-semibold tracking-tight text-slate-100">
                  {cliente.name}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
          <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/80 md:inline">
            · ghost kitchen Olón
          </span>
        </div>
        {/* R96.13 · open/closed badge · pulsing dot + texto compact */}
        <span
          className={[
            "mr-2 hidden shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium sm:inline-flex",
            hours.isOpen
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
              : "border-rose-500/40 bg-rose-500/10 text-rose-200",
          ].join(" ")}
          title={
            hours.isOpen
              ? `Cerramos a las ${hours.closesAtText}`
              : `Abrimos ${hours.opensAtText ?? "pronto"}`
          }
        >
          <span
            aria-hidden
            className={[
              "h-1.5 w-1.5 rounded-full",
              hours.isOpen
                ? "bg-emerald-400 animate-pulse"
                : "bg-rose-400",
            ].join(" ")}
          />
          {hours.isOpen ? (
            <>Abierto · hasta {hours.closesAtText}</>
          ) : (
            <>Cerrado · {hours.opensAtText ? `vuelve ${hours.opensAtText}` : "vuelve pronto"}</>
          )}
        </span>
        {/* R96.113 · perlas chip + icono usuario · click abre AccountModal. */}
        {account && account.perlas > 0 ? (
          <button
            type="button"
            onClick={onOpenAccount}
            className="mr-2 inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20"
            title={`${account.perlas} perlas · ≈$${(account.perlas * 0.01).toFixed(2)}`}
          >
            <span aria-hidden>✦</span>
            <span className="tabular-nums">{account.perlas}</span>
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenAccount}
          className="mr-2 inline-flex shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 p-1.5 text-cyan-100 transition-colors hover:bg-cyan-500/20"
          aria-label="Mi cuenta"
          title={account ? "Mi cuenta" : "Iniciar sesión"}
        >
          <User className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cart.open}
          className="relative inline-flex shrink-0 items-center gap-2 rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-sm text-violet-100 transition-colors hover:bg-violet-500/20"
          aria-label="Abrir canoa de compras"
        >
          <CanoeIcon className="h-5 w-5" />
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
