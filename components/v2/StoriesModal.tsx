"use client"
/**
 * StoriesModal · R97.8 · "Pesca del día" · galería de platos con descripción
 * poética · Instagram-style vertical · cada slide = 1 plato del menú con
 * foto + nombre + descripción poética + disclaimer opcional + CTA cart.
 *
 * Fotos viven en /public/stories/<id>.jpg · Emilio sube las imágenes
 * según las va sacando · cuando una falta · cae a emoji placeholder.
 */
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import Image from "next/image"
import { useCart } from "@/lib/v2/cart-context"

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const SAND = "#F5E9D2"

interface DishStory {
  /** id del menu item · linkea a MENU_ITEMS de naufrago-content.ts */
  itemId: string
  name: string
  /** Path relativo a /public/ · ej "/stories/encebollado-naufrago.jpg" */
  imageUrl?: string | null
  /** Emoji fallback cuando no hay foto · grande */
  emoji: string
  /** Descripción poética del cocinero · 1-3 frases */
  poetic: string
  /** Disclaimer opcional · estilo etiqueta nutricional · cursive small */
  warning?: string
  priceUsd: number
}

// Galería curada · Emilio agrega platos según va sacando fotos.
// Path imageUrl puede ser null hasta que la foto esté en /public/stories/
const DISHES: DishStory[] = [
  {
    itemId: "encebollado-naufrago",
    name: "Encebollado Náufrago",
    imageUrl: "/stories/encebollado-naufrago.jpg",
    emoji: "🍲",
    poetic:
      "Poderoso caldo lleno de las bondades de la Pachamama · siempre fresco · siempre abundante.",
    warning:
      "Atención · no nos responsabilizamos por efectos secundarios serios como exceso de energía y vitalidad. Consumir con responsabilidad.",
    priceUsd: 4,
  },
  // ─── Pendientes de foto · agregar cuando Emilio suba ──────────────
  {
    itemId: "encebollado-mixto",
    name: "Encebollado Mixto",
    imageUrl: null,
    emoji: "🍲",
    poetic: "Pescado del muelle y camarón del estero · dos mundos del mar en un solo plato.",
    priceUsd: 6,
  },
  {
    itemId: "ceviche-naufrago",
    name: "Ceviche Náufrago",
    imageUrl: "/stories/ceviche-naufrago.jpg",
    emoji: "🐟",
    poetic:
      "Pescado curtido en leche de tigre · aguacate cremoso · salsa de maní de la abuela.",
    priceUsd: 7,
  },
  {
    itemId: "ceviche-mixto",
    name: "Ceviche Mixto",
    imageUrl: "/stories/ceviche-mixto.jpg",
    emoji: "🦐",
    poetic: "Camarón y pescado curtidos · maridaje del mar a tu mesa de playa.",
    priceUsd: 9,
  },
  {
    itemId: "patacones-naufrago",
    name: "Patacones Náufrago",
    imageUrl: null,
    emoji: "🍌",
    poetic:
      "Verdes fritos al carbón · queso · huevo · sal prieta que sabe a Manabí.",
    priceUsd: 4,
  },
]

export interface StoriesModalProps {
  open: boolean
  onClose: () => void
}

export function StoriesModal({ open, onClose }: StoriesModalProps) {
  const cart = useCart()
  const [idx, setIdx] = useState(0)
  const [imgError, setImgError] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    setIdx(0)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1))
      if (e.key === "ArrowRight") setIdx((i) => Math.min(DISHES.length - 1, i + 1))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const current = DISHES[idx]
  const hasImg = Boolean(current.imageUrl) && !imgError[current.itemId]

  function handleCta() {
    cart.add({
      id: current.itemId,
      name: current.name,
      priceUsd: current.priceUsd,
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
          className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm"
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
            boxShadow: "0 24px 48px -12px rgba(0,0,0,0.6)",
          }}
        >
          {/* Progress bars · stories style */}
          <div className="flex gap-1 px-3 pt-3">
            {DISHES.map((_, i) => (
              <div
                key={i}
                className="h-0.5 flex-1 rounded-full"
                style={{
                  background:
                    i < idx
                      ? "#FFFFFF"
                      : i === idx
                        ? CYAN
                        : "rgba(255,255,255,0.20)",
                }}
              />
            ))}
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/75">
              {idx + 1} de {DISHES.length} · Fotos del menú
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

          {/* Image / emoji */}
          <div
            className="relative aspect-square w-full overflow-hidden"
            style={{ background: SAND }}
          >
            {hasImg ? (
              <Image
                src={current.imageUrl!}
                alt={current.name}
                fill
                sizes="(max-width: 640px) 100vw, 384px"
                className="object-cover"
                onError={() =>
                  setImgError((m) => ({ ...m, [current.itemId]: true }))
                }
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2">
                <span className="text-[120px] leading-none drop-shadow-lg">
                  {current.emoji}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-purple-900/60">
                  Foto en camino
                </span>
              </div>
            )}
            {/* Tap zones */}
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
              onClick={() => setIdx((i) => Math.min(DISHES.length - 1, i + 1))}
              disabled={idx === DISHES.length - 1}
              className="absolute right-0 top-0 h-full w-1/3 disabled:cursor-not-allowed"
            />
          </div>

          {/* Body · nombre + poética + warning + CTA */}
          <div className="space-y-3 px-5 py-4">
            <h3 className="font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wider text-white">
              {current.name}
            </h3>
            <p className="font-[family-name:var(--font-handwritten),cursive] text-base italic leading-relaxed text-white/90">
              {current.poetic}
            </p>
            {current.warning ? (
              <div
                className="rounded-xl border px-3 py-2"
                style={{
                  background: "rgba(217,34,53,0.08)",
                  borderColor: "rgba(217,34,53,0.30)",
                }}
              >
                <span className="block font-mono text-[9px] uppercase tracking-[0.2em] text-rose-300">
                  ⚠ Advertencia
                </span>
                <p className="mt-0.5 text-[11px] italic leading-snug text-rose-100/85">
                  {current.warning}
                </p>
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleCta}
              style={{
                background: `linear-gradient(90deg, ${CYAN} 0%, #2BA8AC 100%)`,
                color: PURPLE,
              }}
              className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-bold shadow-lg"
            >
              ✦ Agregar a la Canoa ·{" "}
              <span className="font-mono">${current.priceUsd.toFixed(2)}</span>
            </button>

            {/* Manual nav · desktop friendly */}
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
                onClick={() => setIdx((i) => Math.min(DISHES.length - 1, i + 1))}
                disabled={idx === DISHES.length - 1}
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
