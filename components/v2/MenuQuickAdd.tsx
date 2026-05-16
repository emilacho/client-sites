"use client"
/**
 * MenuQuickAdd · floating menu strip at the bottom of the page.
 *
 * Compact horizontal row of 3 cards (Encebollado / Ceviche / Patacones)
 * with the 2D thumbnail + price + "Add" CTA. Tap → add to cart + open
 * the cart drawer for instant feedback. Functions as the primary
 * "menu" UI since the 3D scene is the visual hero.
 */
import { Plus } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"
import { naufragoV2 } from "@/lib/v2/naufrago-content"

export function MenuQuickAdd() {
  const cart = useCart()
  return (
    <div
      id="menu"
      className="pointer-events-none fixed inset-x-0 bottom-3 z-30 px-3 md:bottom-6 md:px-6"
    >
      <div className="pointer-events-auto mx-auto flex max-w-4xl flex-col gap-2 rounded-2xl border border-slate-800/80 bg-slate-950/80 p-2 backdrop-blur-xl md:flex-row md:gap-2.5 md:p-2.5">
        <div className="flex items-center gap-2 px-2 pt-1 md:px-1 md:pt-0">
          <span className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">
            {naufragoV2.menu.length === 3 ? "Hoy en el puerto" : "Menú"}
          </span>
        </div>
        <ul className="flex flex-1 gap-2 overflow-x-auto md:gap-2.5">
          {naufragoV2.menu.map((item) => (
            <li
              key={item.id}
              className="flex shrink-0 items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/60 p-2 md:flex-1 md:p-2.5"
            >
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${item.gradient} text-xl shadow-inner ring-1 ring-white/20`}
                aria-hidden
              >
                {item.emoji}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-100">
                    {item.name}
                  </span>
                  <span className="font-mono text-xs tabular-nums text-cyan-200">
                    ${item.priceUsd.toFixed(2)}
                  </span>
                </div>
                <span className="truncate text-[10.5px] text-slate-400">
                  {item.tags.slice(0, 2).join(" · ")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  cart.add({
                    id: item.id,
                    name: item.name,
                    priceUsd: item.priceUsd,
                  })
                  cart.open()
                }}
                aria-label={`Agregar ${item.name} al pedido`}
                className="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-500 text-white shadow-md shadow-violet-500/30 transition-transform hover:scale-105"
              >
                <Plus className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
