"use client"
/**
 * StoriesModal · R97.8 · "Pesca del día"
 *
 * Instagram-style vertical stories · 4-5 cards rotating · cada una con
 * pic + caption + CTA. Contenido admin-controllable via WhatsApp ·
 * pattern R96.139 (jugos del día) extendido para keys ·
 *   pesca_del_dia · jugos_del_dia · combo_del_dia · promo_atardecer
 *
 * Por ahora placeholder hasta que Emilio suba las fotos · cuando estén ·
 * los URLs van en la tabla naufrago.dynamic_options · el modal los pull.
 */
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const SAND = "#F5E9D2"

interface Story {
  id: string
  title: string
  caption: string
  imageUrl?: string | null
  emoji?: string
  ctaLabel?: string
  itemId?: string
  itemPriceUsd?: number
  itemName?: string
}

// Placeholder stories · cuando Emilio suba fotos · reemplazar imageUrl
const PLACEHOLDER_STORIES: Story[] = [
  {
    id: "pesca",
    title: "Pesca del día",
    caption: "Hoy llegó del muelle · corvina fresca del Pacífico ecuatoriano. Limpiada esta mañana · lista para el caldo o el curtido.",
    emoji: "🐟",
    ctaLabel: "Sumar Encebollado",
    itemId: "encebollado-naufrago",
    itemName: "Encebollado Náufrago",
    itemPriceUsd: 4,
  },
  {
    id: "jugos",
    title: "Jugos del día",
    caption: "Naranjas exprimidas hoy · maracuyá del huerto · tamarindo casero. Cada uno fresco · sin azúcar añadida.",
    emoji: "🍹",
    ctaLabel: "Sumar Jugo natural",
    itemId: "jugo-natural",
    itemName: "Jugo natural del día",
    itemPriceUsd: 2,
  },
  {
    id: "combo",
    title: "Combo del cocinero",
    caption: "Encebollado Náufrago + Cola pequeña · ahorrás $0.50 vs comprarlos por separado. Solo hoy.",
    emoji: "🍱",
    ctaLabel: "Pedir combo",
    itemId: "encebollado-naufrago",
    itemName: "Combo Cocinero",
    itemPriceUsd: 4.75,
  },
  {
    id: "atardecer",
    title: "Promo del atardecer",
    caption: "Pedís antes de las 19:00 · 20% off en cualquier ceviche. Sol bajando + ceviche fresco = combinación náufrago.",
    emoji: "🌅",
    ctaLabel: "Ver ceviches",
    itemId: "ceviche-naufrago",
    itemName: "Ceviche Náufrago",
    itemPriceUsd: 7,
  },
]

export interface StoriesModalProps {
  open: boolean
  onClose: () => void
}

export function StoriesModal({ open, onClose }: StoriesModalProps) {
  const cart = useCart()
  const [idx, setIdx] = useState(0)
  // TODO · cuando dynamic_options esté wireado · fetch real stories acá
  const stories = PLACEHOLDER_STORIES

  useEffect(() => {
    if (!open) return
    setIdx(0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1))
      if (e.key === "ArrowRight")
        setIdx((i) => Math.min(stories.length - 1, i + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose, stories.length])

  if (!open) return null

  const current = stories[idx]

  function handleCta() {
    if (!current.itemId || !current.itemName || !current.itemPriceUsd) return
    cart.add({
      id: current.itemId,
      name: current.itemName,
      priceUsd: current.itemPriceUsd,
    })
    onClose()
    cart.open()
  }

  return (
    <AnimatePresence>
      <motion.div
        key="stories-root"
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: "8%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "8%", opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="relative z-10 w-full max-w-sm overflow-hidden rounded-3xl"
          style={{
            background: `linear-gradient(180deg, ${PURPLE} 0%, #1F1138 100%)`,
            border: `3px solid ${PURPLE}`,
          }}
        >
          {/* Progress bars · stories style */}
          <div className="flex gap-1 px-3 pt-3">
            {stories.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full"
                style={{
                  background:
                    i < idx
                      ? "#FFFFFF"
                      : i === idx
                        ? CYAN
                        : "rgba(255,255,255,0.25)",
                }}
              />
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white opacity-75">
              {idx + 1} de {stories.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Image / emoji placeholder */}
          <div
            className="relative aspect-square w-full overflow-hidden"
            style={{ background: SAND }}
          >
            {current.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={current.imageUrl}
                alt={current.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-9xl drop-shadow-lg">
                  {current.emoji ?? "🌊"}
                </span>
              </div>
            )}
            {/* Tap zones for prev/next */}
            <button
              type="button"
              aria-label="Anterior"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="absolute left-0 top-0 h-full w-1/3 disabled:cursor-not-allowed"
            />
            <button
              type="button"
              aria-label="Siguiente"
              onClick={() =>
                setIdx((i) => Math.min(stories.length - 1, i + 1))
              }
              disabled={idx === stories.length - 1}
              className="absolute right-0 top-0 h-full w-1/3 disabled:cursor-not-allowed"
            />
          </div>

          {/* Body · title + caption + CTA */}
          <div className="space-y-3 px-5 py-4">
            <h3
              className="font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wider text-white"
            >
              {current.title}
            </h3>
            <p
              className="font-[family-name:var(--font-handwritten),cursive] text-base italic leading-relaxed text-white/85"
            >
              {current.caption}
            </p>
            {current.ctaLabel && current.itemId ? (
              <button
                type="button"
                onClick={handleCta}
                style={{
                  background: `linear-gradient(90deg, ${CYAN} 0%, #2BA8AC 100%)`,
                  color: PURPLE,
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold shadow-lg"
              >
                ✦ {current.ctaLabel}
                {current.itemPriceUsd ? (
                  <span className="font-mono">${current.itemPriceUsd.toFixed(2)}</span>
                ) : null}
              </button>
            ) : null}

            {/* Manual nav buttons (desktop friendly) */}
            <div className="flex items-center justify-between text-white/60">
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                disabled={idx === 0}
                className="flex items-center gap-1 text-xs disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  setIdx((i) => Math.min(stories.length - 1, i + 1))
                }
                disabled={idx === stories.length - 1}
                className="flex items-center gap-1 text-xs disabled:opacity-30"
              >
                Siguiente <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
