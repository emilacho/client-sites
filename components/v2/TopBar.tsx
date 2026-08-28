"use client"
/**
 * TopBar · barra flotante con la marca y el acceso a la canoa.
 *
 * R111 · acá había una DETECCIÓN DE UBICACIÓN del cliente que reemplazaba
 * el nombre de la marca por la calle donde estaba parado. Se sacó, por
 * tres razones y ninguna es de gusto:
 *
 *  1. No servía para nada. No completaba la dirección de entrega, no
 *     calculaba el envío, no alimentaba ningún campo · sólo decoraba.
 *  2. Era imprecisa por diseño. En computadora el navegador ubica por
 *     WiFi y por dirección de internet, y falla por kilómetros · le
 *     mostraba al cliente una calle que no era la suya.
 *  3. Pedía permiso de ubicación apenas cargaba la página, sin decir
 *     para qué. Eso espanta gente antes de que vea la carta.
 *
 * La ubicación SÍ se pide donde hace falta: en el paso de la dirección
 * de entrega, con mapa y preguntando "¿esta es tu dirección actual?"
 * para que el cliente confirme o corrija (MapAddressPicker).
 */

import { User } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"
import { useBusinessHours } from "@/lib/v2/use-business-hours"
import { useAccount } from "@/lib/v2/use-account"
import { cliente } from "@/cliente.config"
import { CanoeIcon } from "./CanoeIcon"
import PerlasChip from "./PerlasChip"

interface TopBarProps {
  onOpenAccount?: () => void
}

export function TopBar({ onOpenAccount }: TopBarProps = {}) {
  const cart = useCart()
  const hours = useBusinessHours()
  const { account } = useAccount()

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-30 px-3 pt-3 md:px-6 md:pt-4">
      <div className="pointer-events-auto mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center rounded-full border border-slate-800/80 bg-slate-950/65 px-4 py-2 backdrop-blur-xl md:px-5">
        {/* Columna izquierda · la marca, siempre. R111 · antes acá
            rotaba entre "detectando ubicación…", la calle del cliente y
            la marca. Ahora es la marca y punto. */}
        <div className="flex min-w-0 items-center gap-2.5 pr-3">
          <span
            aria-hidden
            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-gradient-to-br from-violet-400 to-cyan-400 shadow-[0_0_10px_rgba(124,58,237,0.7)]"
          />
          <span className="truncate font-display text-sm font-semibold tracking-tight text-slate-100">
            {cliente.name}
          </span>
        </div>
        {/* Center column · subtítulo del ghost kitchen · CENTRADO · solo
            visible en desktop (md+) · mobile lo oculta para ahorrar espacio */}
        <span className="hidden truncate font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/80 md:inline">
          ghost kitchen Guayaquil · restaurante Olón, Sta Elena
        </span>
        {/* Right column · icons cluster · justify-end mantiene anclados a la derecha */}
        <div className="flex items-center justify-end gap-0">
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
        {/* R96.119 · perlas chip animated count-up + click abre AccountModal */}
        {account ? (
          <PerlasChip value={Number(account.perlas) || 0} onClick={onOpenAccount} />
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
      </div>
    </header>
  )
}
