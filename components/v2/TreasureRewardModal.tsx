"use client"
/**
 * TreasureRewardModal · Round 82 · castaway parchment.
 *
 * Opens on cofre click WITHOUT animating the chest itself. A
 * hyperrealistic aged-paper pergamino unfolds on screen · the
 * kind a castaway scribbled in pencil and rolled into a bottle.
 *
 * Visual goals (per user dispatch):
 *  - papel viejo arrugado color café · aged kraft paper, sepia
 *    edges, wrinkle folds, coffee stains, torn irregular outline
 *  - letra manuscrita "como lo haría un náufrago con su puño y
 *    letra" · uses Permanent Marker (already loaded as
 *    --font-marker via app/layout.tsx · powers the character
 *    speech bubble too · same scrawled handwriting personality)
 *  - dark sepia ink, slight rotations, hand-drawn code box
 *
 * Sequence (≈800ms): fade + scale in + small wobble. No chest
 * animation, no explosion, no royal-purple card. The paper IS
 * the visual.
 *
 * Discount auto-applies (NAUFRAGO5 · 5%) the moment the modal
 * opens.
 */
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"

const DISCOUNT_CODE = "NAUFRAGO5"
const DISCOUNT_PERCENT = 5

export interface TreasureRewardModalProps {
  open: boolean
  onClose: () => void
  onOpenMenu: () => void
}

export function TreasureRewardModal({
  open,
  onClose,
  onOpenMenu,
}: TreasureRewardModalProps) {
  const cart = useCart()
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  useEffect(() => {
    if (open) cart.applyCode(DISCOUNT_CODE)
  }, [open, cart])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DISCOUNT_CODE)
      setCopied(true)
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2200)
    } catch {
      /* clipboard API failed · ignore, the visible code still reads */
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* Transparent backdrop · isla visible (R78 spec) */}
          <motion.div
            key="parchment-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: "transparent" }}
            aria-hidden
          />

          {/* Parchment + CTAs · no surrounding card */}
          <motion.div
            key="parchment-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Mensaje del náufrago"
            initial={{ opacity: 0, scale: 0.5, rotate: -4, y: 30 }}
            animate={{
              opacity: 1,
              scale: 1,
              rotate: -1.5,
              y: 0,
            }}
            exit={{ opacity: 0, scale: 0.7, rotate: -3, y: 20 }}
            transition={{
              duration: 0.7,
              ease: [0.34, 1.4, 0.64, 1],
            }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative">
              {/* Close (top-right, on top of paper) */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#3a2818]/85 text-[#e8d2a8] shadow-lg transition-colors hover:bg-[#3a2818]"
              >
                <X className="h-5 w-5" />
              </button>

              <button
                type="button"
                onClick={handleCopy}
                aria-label={`Copiar código ${DISCOUNT_CODE}`}
                className="block active:translate-y-[1px]"
                style={{
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                }}
              >
                <CastawayParchment
                  code={DISCOUNT_CODE}
                  percent={DISCOUNT_PERCENT}
                  copied={copied}
                />
              </button>

              {/* CTAs · sit just below the paper, no purple panel */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.5 }}
                className="mt-5 flex justify-center gap-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenMenu()
                  }}
                  className="rounded-full bg-gradient-to-r from-[#4DD4D8] to-[#7c3aed] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-900/40"
                >
                  Ver el menú
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-[#3a2818]/40 bg-[#f5e6cb]/80 px-5 py-2.5 text-sm font-medium text-[#3a2818] backdrop-blur-sm"
                >
                  Cerrar
                </button>
              </motion.div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

/**
 * CastawayParchment · the hand-drawn aged-paper SVG.
 *
 * Layering (back to front):
 *   1. Outer torn shadow (darker offset path)
 *   2. Burnt-edge gradient overlay
 *   3. Paper body · slightly irregular path with kraft-tan fill
 *   4. Wrinkle lines (subtle dark curves)
 *   5. Coffee stains (radial brown blobs)
 *   6. Handwritten text (Permanent Marker) in dark sepia ink
 *   7. Hand-drawn code box + emphasized code
 *   8. Castaway signature bottom-right with slight tilt
 *
 * Path coordinates are hand-tuned to feel irregular without
 * looking glitchy · viewBox 0 0 440 540 keeps the modal close
 * to letter-paper proportions at a moderate size.
 */
function CastawayParchment({
  code,
  percent,
  copied,
}: {
  code: string
  percent: number
  copied: boolean
}) {
  return (
    <svg
      width="440"
      height="540"
      viewBox="0 0 440 540"
      className="block drop-shadow-[0_24px_50px_rgba(0,0,0,0.55)]"
      aria-hidden
    >
      <defs>
        {/* Paper base · kraft tan, lighter center darker edges */}
        <radialGradient id="parchment-body" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0%" stopColor="#EAD4A6" />
          <stop offset="55%" stopColor="#D7B583" />
          <stop offset="100%" stopColor="#8B6A3F" />
        </radialGradient>
        {/* Burnt overlay · multiplies darker brown at the very edge */}
        <radialGradient id="parchment-burn" cx="0.5" cy="0.5" r="0.7">
          <stop offset="0%" stopColor="rgba(0,0,0,0)" />
          <stop offset="78%" stopColor="rgba(58,40,24,0.0)" />
          <stop offset="100%" stopColor="rgba(58,40,24,0.55)" />
        </radialGradient>
        {/* Subtle paper grain · semi-transparent noise via SVG turbulence */}
        <filter id="parchment-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="2"
            seed="7"
          />
          <feColorMatrix
            values="0 0 0 0 0.22
                    0 0 0 0 0.14
                    0 0 0 0 0.08
                    0 0 0 0.10 0"
          />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        {/* Coffee stain gradient · circular sepia smear */}
        <radialGradient id="coffee-stain" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="rgba(74,42,26,0.0)" />
          <stop offset="60%" stopColor="rgba(74,42,26,0.28)" />
          <stop offset="85%" stopColor="rgba(74,42,26,0.45)" />
          <stop offset="100%" stopColor="rgba(74,42,26,0.0)" />
        </radialGradient>
      </defs>

      {/* DROP-SHADOW PAPER · slightly offset darker shape behind */}
      <path
        d="M 32 56
           Q 50 50 90 48
           L 220 42
           Q 280 40 340 50
           Q 390 60 408 80
           L 412 200
           Q 416 320 408 440
           Q 400 480 360 492
           L 220 502
           Q 110 506 60 496
           Q 30 488 24 460
           L 22 320
           Q 20 200 26 110
           Q 28 75 32 56 Z"
        fill="#3a2818"
        opacity="0.25"
        transform="translate(4, 8)"
      />

      {/* MAIN PAPER · irregular torn outline */}
      <path
        d="M 32 56
           Q 50 50 90 48
           L 220 42
           Q 280 40 340 50
           Q 390 60 408 80
           L 412 200
           Q 416 320 408 440
           Q 400 480 360 492
           L 220 502
           Q 110 506 60 496
           Q 30 488 24 460
           L 22 320
           Q 20 200 26 110
           Q 28 75 32 56 Z"
        fill="url(#parchment-body)"
        stroke="#6b4824"
        strokeWidth="1"
        strokeOpacity="0.4"
      />

      {/* BURN OVERLAY · darkens edges */}
      <path
        d="M 32 56
           Q 50 50 90 48
           L 220 42
           Q 280 40 340 50
           Q 390 60 408 80
           L 412 200
           Q 416 320 408 440
           Q 400 480 360 492
           L 220 502
           Q 110 506 60 496
           Q 30 488 24 460
           L 22 320
           Q 20 200 26 110
           Q 28 75 32 56 Z"
        fill="url(#parchment-burn)"
      />

      {/* Tiny torn nicks along the edges · little V cuts */}
      <g fill="#3a2818" opacity="0.25">
        <path d="M 150 42 l 6 -6 l 4 6 z" />
        <path d="M 280 44 l 5 -5 l 4 6 z" />
        <path d="M 412 220 l 6 -3 l -2 7 z" />
        <path d="M 415 380 l 6 -4 l -1 8 z" />
        <path d="M 320 501 l 4 7 l 5 -6 z" />
        <path d="M 120 502 l 4 7 l 5 -6 z" />
        <path d="M 22 360 l -7 -3 l 2 8 z" />
        <path d="M 22 180 l -7 -3 l 2 8 z" />
      </g>

      {/* WRINKLE LINES · subtle paper folds */}
      <g
        stroke="#5b3a24"
        strokeOpacity="0.18"
        strokeWidth="1.2"
        fill="none"
      >
        {/* horizontal-ish folds */}
        <path d="M 30 140 Q 220 134 410 150" />
        <path d="M 28 280 Q 220 274 410 290" />
        <path d="M 30 420 Q 220 415 408 430" />
        {/* diagonal crease */}
        <path d="M 60 60 Q 200 180 390 380" />
        {/* small left-side wrinkle */}
        <path d="M 30 200 Q 90 220 30 260" />
      </g>

      {/* COFFEE STAINS */}
      <ellipse cx="350" cy="120" rx="34" ry="22" fill="url(#coffee-stain)" />
      <ellipse cx="80" cy="360" rx="46" ry="30" fill="url(#coffee-stain)" />
      <ellipse cx="380" cy="440" rx="28" ry="18" fill="url(#coffee-stain)" />
      <circle cx="370" cy="138" r="3" fill="#3a2818" opacity="0.35" />
      <circle cx="76" cy="380" r="2.5" fill="#3a2818" opacity="0.35" />

      {/* GRAIN TEXTURE · masked to the paper outline */}
      <g filter="url(#parchment-grain)" opacity="0.5">
        <rect x="0" y="0" width="440" height="540" />
      </g>

      {/* ── HANDWRITTEN MESSAGE ────────────────────────────────
       *
       * Permanent Marker · scrawled castaway voice. Lines are
       * tilted ±1-2° individually so each line reads as a separate
       * stroke of the pen, not aligned typesetting. Ink color
       * #3a2818 (dark sepia).
       */}
      <g
        fill="#3a2818"
        style={{
          fontFamily:
            'var(--font-marker), "Permanent Marker", "Caveat", cursive',
        }}
      >
        <text
          x="60"
          y="100"
          fontSize="22"
          transform="rotate(-1.5 60 100)"
        >
          Quien lea esta nota,
        </text>
        <text
          x="60"
          y="138"
          fontSize="18"
          transform="rotate(-0.8 60 138)"
        >
          si llegaste hasta acá fue
        </text>
        <text
          x="60"
          y="162"
          fontSize="18"
          transform="rotate(-1.1 60 162)"
        >
          por curioso. Eso es bueno.
        </text>

        <text
          x="60"
          y="208"
          fontSize="18"
          transform="rotate(0.6 60 208)"
        >
          Te dejo mi último tesoro
        </text>
        <text
          x="60"
          y="232"
          fontSize="18"
          transform="rotate(-0.5 60 232)"
        >
          antes que se lo lleve el mar:
        </text>

        {/* The percentage · big, emphasized */}
        <text
          x="220"
          y="290"
          textAnchor="middle"
          fontSize="56"
          fontWeight="bold"
          transform="rotate(-2 220 290)"
        >
          {percent}% off
        </text>
        <text
          x="220"
          y="318"
          textAnchor="middle"
          fontSize="14"
          transform="rotate(-1 220 318)"
        >
          en tu primer pedido
        </text>
      </g>

      {/* HAND-DRAWN CODE BOX · uneven rectangle around the code */}
      <g>
        <path
          d="M 92 360
             L 348 354
             L 352 412
             L 88 416
             Z"
          fill="rgba(255,255,255,0.35)"
          stroke="#3a2818"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeOpacity="0.7"
        />
        {/* second pass · "scribbled twice" feel */}
        <path
          d="M 90 362
             L 346 356
             L 350 410
             L 90 414"
          fill="none"
          stroke="#3a2818"
          strokeWidth="1.4"
          strokeOpacity="0.45"
          strokeLinejoin="round"
        />
        <text
          id="treasure-code-text"
          x="220"
          y="396"
          textAnchor="middle"
          fontSize="38"
          fontWeight="bold"
          letterSpacing="3"
          fill="#2a1810"
          style={{
            fontFamily:
              'var(--font-marker), "Permanent Marker", "Caveat", cursive',
          }}
          transform="rotate(-1 220 396)"
        >
          {code}
        </text>
      </g>

      {/* Tap-hint or copied feedback */}
      <text
        x="220"
        y="440"
        textAnchor="middle"
        fontSize="12"
        fill={copied ? "#14532d" : "#5b3a24"}
        style={{
          fontFamily:
            'var(--font-marker), "Permanent Marker", "Caveat", cursive',
        }}
      >
        {copied ? "¡copiado!" : "tócalo para guardarlo"}
      </text>

      {/* CASTAWAY SIGNATURE bottom-right · rotated more */}
      <g
        fill="#2a1810"
        style={{
          fontFamily:
            'var(--font-marker), "Permanent Marker", "Caveat", cursive',
        }}
      >
        <text
          x="350"
          y="478"
          textAnchor="end"
          fontSize="20"
          transform="rotate(-4 350 478)"
        >
          — El Náufrago
        </text>
        {/* tiny scribbled sea-line under the signature */}
        <path
          d="M 280 488 Q 310 484 340 488 T 370 484"
          stroke="#2a1810"
          strokeWidth="1.5"
          fill="none"
          opacity="0.55"
          transform="rotate(-4 320 486)"
        />
      </g>
    </svg>
  )
}
