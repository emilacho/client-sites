"use client"
/**
 * CombosModal · R97.8 · "Combos para compartir"
 *
 * Pre-armados curados · click "Pedir combo" agrega items directamente al
 * cart. Encebollado + Cola · Ceviche para 2 · etc.
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
  discountUsd: number
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
    discountUsd: 0.5,
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
    discountUsd: 1.5,
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
                3 combos curados por el cocinero · ahorrás el envío de pensar.
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
              const subtotal = combo.items.reduce(
                (s, it) => s + it.priceUsd * it.qty,
                0,
              )
              const final = subtotal - combo.discountUsd
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
                      <span className="line-through opacity-50">
                        ${subtotal.toFixed(2)}
                      </span>
                      {"  "}
                      <span className="font-bold" style={{ color: CYAN }}>
                        ${final.toFixed(2)}
                      </span>
                      {"  "}
                      <span className="text-[10px] opacity-60">
                        · ahorrás ${combo.discountUsd.toFixed(2)}
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
            Los items se agregan al cart · podés ajustarlos antes de confirmar.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
