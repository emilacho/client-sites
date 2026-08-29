"use client"
/**
 * CombosModal · "Combos para compartir"
 *
 * Pre-armados curados · click "Pedir combo" agrega los platos al carrito.
 *
 * R130 · EL COMBO NO TIENE DESCUENTO, Y ES A PROPOSITO.
 *
 * Hasta R129 esta pantalla anunciaba "$5.25 tachado · $4.75 · ahorras
 * $0.50" y despues cobraba $5.25: `pickCombo` agrega los platos a precio
 * de lista y el carrito nunca supo de `discountUsd`. Prometia una cosa y
 * cobraba otra, que es la peor forma de fallar porque el cliente lo
 * descubre despues de comprar.
 *
 * Se arreglo sacando la promesa, no agregando el descuento. Razones,
 * medidas el 29-ago-2026 ·
 *   - Contra los mismos competidores en apps de reparto, Náufrago ya
 *     esta 17-22% por debajo: encebollado $4.00 contra $5.05, ceviche
 *     $7.00 contra $8.95, cola $1.25 contra $1.95. El descuento se
 *     montaba sobre el precio mas bajo de la comparacion.
 *   - En este mercado el combo se usa para SUBIR el ticket, no para
 *     bajarlo: El Rincon del Ceviche vende su "Combo Encebollado de
 *     Albacora" a $8.62. Casa del Encebollado no tiene combos.
 *   - Los $0.50 del Surfer eran el 9,5% del ticket sobre el plato mas
 *     barato. Sumados al pergamino (5%) y al tesoro (4%) se llevaban
 *     cerca de un tercio de la ganancia del pedido.
 * Misma leccion que el club en R122 · cobrar menos y regalar menos.
 *
 * El combo se vende por lo que de verdad ahorra: el trabajo de armarlo.
 * Decision de Emilio, 29-ago-2026.
 */
import { useEffect } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"

interface ComboItem {
  itemId: string
  itemName: string
  priceUsd: number
  qty: number
}

interface Combo {
  id: string
  label: string
  emoji: string
  description: string
  items: ComboItem[]
}

const COMBOS: Combo[] = [
  {
    id: "combo-surfer",
    label: "Combo Surfer",
    emoji: "🏄",
    description: "Para después de la ola · Encebollado + cola pequeña.",
    items: [
      { itemId: "encebollado-naufrago", itemName: "Encebollado Náufrago", priceUsd: 4, qty: 1 },
      { itemId: "cola-pequena", itemName: "Cola pequeña · Coca-Cola", priceUsd: 1.25, qty: 1 },
    ],
  },
  {
    id: "combo-pareja",
    label: "Combo Pareja",
    emoji: "💑",
    description: "2 ceviches Náufrago + 2 jugos del día · perfecto atardecer.",
    items: [
      { itemId: "ceviche-naufrago", itemName: "Ceviche Náufrago", priceUsd: 7, qty: 2 },
      { itemId: "jugo-natural", itemName: "Jugo natural del día", priceUsd: 2, qty: 2 },
    ],
  },
  // R104.4 · el Combo Familia queda FUERA hasta nueva orden: su gracia era
  // "Encebollado Mixto + Patacones + 2 colas", y sin patacones ya no es ese
  // combo. Recomponerlo es decidir qué se ofrece y a qué precio · eso lo
  // decide Emilio, no este archivo. Vuelve en cuanto diga con qué.
]

export interface CombosModalProps {
  open: boolean
  onClose: () => void
}

export function CombosModal({ open, onClose }: CombosModalProps) {
  const cart = useCart()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  function pickCombo(combo: Combo) {
    for (const it of combo.items) {
      cart.add(
        { id: it.itemId, name: it.itemName, priceUsd: it.priceUsd },
        it.qty,
      )
    }
    onClose()
    cart.open()
  }

  return (
    <AnimatePresence>
      <motion.div
        key="combos-root"
        className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: "8%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "8%", opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-slate-950 px-5 py-5 text-slate-100 md:rounded-3xl"
          style={{ border: `2px solid ${PURPLE}` }}
        >
          <header className="mb-4 flex items-start justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
                Combos para compartir
              </span>
              <h2
                className="mt-1 font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wider"
                style={{ color: "#FFFFFF" }}
              >
                COMBO DEL DÍA
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                {/* R118 · el número sale del arreglo. Estaba escrito a mano
                    y decía 3 · al sacar el Combo Familia (se iba con los
                    patacones) quedó diciendo 3 con 2 en pantalla. Un número
                    a mano se desincroniza sin que nadie lo note. */}
                {COMBOS.length} combos curados por el cocinero · ahorras el
                envío de pensar.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <ul className="space-y-2.5">
            {COMBOS.map((combo) => {
              // El total es la suma de los platos · lo mismo, al centavo,
              // que va a quedar en la canoa. Si algun dia vuelve un
              // descuento, tiene que aplicarlo el CARRITO · mostrarlo solo
              // aca es prometer sin cobrar (era el defecto de R129).
              const total = combo.items.reduce(
                (s, it) => s + it.priceUsd * it.qty,
                0,
              )
              return (
                <li
                  key={combo.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{combo.emoji}</span>
                      <div>
                        <span
                          className="block font-[family-name:var(--font-bebas),sans-serif] text-lg tracking-wider"
                          style={{ color: CYAN }}
                        >
                          {combo.label}
                        </span>
                        <span className="block text-[11px] text-slate-400">
                          {combo.description}
                        </span>
                      </div>
                    </div>
                  </div>
                  <ul className="mb-2 space-y-0.5 text-[11px] text-slate-300">
                    {combo.items.map((it, i) => (
                      <li key={i} className="flex justify-between">
                        <span>
                          <span className="font-mono opacity-60">{it.qty}×</span> {it.itemName}
                        </span>
                        <span className="tabular-nums opacity-70">
                          ${(it.priceUsd * it.qty).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between border-t border-slate-800 pt-2">
                    <span className="text-[11px]">
                      <span className="font-bold" style={{ color: CYAN }}>
                        ${total.toFixed(2)}
                      </span>
                      {"  "}
                      <span className="text-[10px] opacity-60">
                        · listo para pedir
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => pickCombo(combo)}
                      style={{
                        background: `linear-gradient(90deg, ${CYAN} 0%, #2BA8AC 100%)`,
                        color: PURPLE,
                      }}
                      className="rounded-full px-3 py-1.5 text-xs font-bold"
                    >
                      Pedir combo
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>

          <p className="mt-3 text-center text-[10px] text-slate-500">
            Los platos se agregan al carrito · puedes ajustarlos antes de confirmar.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
