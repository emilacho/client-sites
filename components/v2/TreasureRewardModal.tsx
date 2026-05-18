"use client"
/**
 * TreasureRewardModal · Round 77.
 *
 * Replaces the MenuModal open-on-cofre-click with a dramatic
 * "treasure found" reveal that hands the customer a 5% discount
 * code (`NAUFRAGO5`).
 *
 * Visual story · the cofre on the island opens, light explodes
 * outward, the code appears like a found coin. Náufrago palette
 * (deep violet #4c1d95 + indigo #3D2466 + celeste #4DD4D8) +
 * gold accents for the treasure feel.
 *
 * Animation timeline (≈1500ms · CSS keyframes + framer-motion):
 *   0-200ms  · backdrop fade in
 *   200-700ms · chest scales up + bounces
 *   600-1000ms · lid swings open + rays burst
 *   800-1300ms · sparkles drift up
 *   1000-1500ms · code chip slides up + glow pulse
 *   1300-1600ms · CTAs fade in
 *
 * Research notes (typical reveal patterns reviewed):
 *  - Gachapon · capsule pops then prize swells · adopted the swell
 *  - Coupon scratch · reveal hidden code · we use a similar
 *    "code becomes visible" beat but with a glow instead of
 *    scratch-off (cleaner on mobile + accessibility)
 *  - Chest open · classic gaming reward · gold rays + sparkles
 *  - Brand reveal animations (Apple keynote · big swell + light)
 *    · we lift the deep-violet → celeste burst from this
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

  // ESC dismiss · only while open
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // Reset copied state when modal closes
  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  // Auto-apply the discount the moment the modal opens · so even
  // if the customer never copies the code, the treasure is theirs.
  // Idempotent · applyCode no-ops if the same code is already set.
  useEffect(() => {
    if (open) cart.applyCode(DISCOUNT_CODE)
  }, [open, cart])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(DISCOUNT_CODE)
      setCopied(true)
      if (copyTimerRef.current) window.clearTimeout(copyTimerRef.current)
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard API can fail on insecure contexts · fall back to
      // text selection so the user can long-press / copy manually.
      const el = document.getElementById("treasure-code-text")
      if (el) {
        const range = document.createRange()
        range.selectNodeContents(el)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    }
  }

  return (
    <AnimatePresence>
      {open ? (
        <>
          {/* SCOPED KEYFRAMES · ray burst + sparkle + glow pulse */}
          <style>{`
            @keyframes naufragoRayBurst {
              0%   { transform: rotate(var(--ray-angle)) scaleY(0); opacity: 0; }
              30%  { opacity: 0.85; }
              100% { transform: rotate(var(--ray-angle)) scaleY(1); opacity: 0; }
            }
            @keyframes naufragoSparkleDrift {
              0%   { transform: translate(0, 0) scale(0); opacity: 0; }
              20%  { opacity: 1; transform: translate(var(--sx), -10px) scale(1); }
              100% { transform: translate(var(--sx), var(--sy)) scale(0.4); opacity: 0; }
            }
            @keyframes naufragoCodeGlow {
              0%, 100% { box-shadow: 0 0 0 0 rgba(77,212,216,0.0), 0 8px 24px rgba(76,29,149,0.55); }
              50%      { box-shadow: 0 0 0 8px rgba(77,212,216,0.15), 0 12px 32px rgba(76,29,149,0.75); }
            }
            @keyframes naufragoLidOpen {
              0%   { transform: rotate(0deg);   transform-origin: 0 100%; }
              100% { transform: rotate(-90deg); transform-origin: 0 100%; }
            }
            @keyframes naufragoChestBounce {
              0%   { transform: scale(0.3) translateY(40px); opacity: 0; }
              60%  { transform: scale(1.08) translateY(-6px); opacity: 1; }
              80%  { transform: scale(0.96) translateY(2px); }
              100% { transform: scale(1.00) translateY(0); }
            }
            .nrm-ray {
              animation: naufragoRayBurst 1300ms ease-out 0.55s 1 forwards;
            }
            .nrm-sparkle {
              animation: naufragoSparkleDrift 1800ms ease-out var(--delay, 0.7s) 1 forwards;
            }
            .nrm-code-glow {
              animation: naufragoCodeGlow 2400ms ease-in-out 1.2s infinite;
            }
            .nrm-lid {
              animation: naufragoLidOpen 600ms cubic-bezier(.34,1.56,.64,1) 0.55s 1 both;
            }
            .nrm-chest {
              animation: naufragoChestBounce 700ms cubic-bezier(.34,1.56,.64,1) 0.15s 1 both;
            }
            @media (prefers-reduced-motion: reduce) {
              .nrm-ray, .nrm-sparkle, .nrm-code-glow,
              .nrm-lid, .nrm-chest {
                animation: none !important;
              }
            }
          `}</style>

          {/* BACKDROP · deep-purple radial vignette */}
          <motion.div
            key="treasure-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{
              background:
                "radial-gradient(ellipse at 50% 45%, rgba(76,29,149,0.92) 0%, rgba(26,10,58,0.98) 70%)",
            }}
            aria-hidden
          />

          {/* PANEL · centered card */}
          <motion.div
            key="treasure-panel"
            role="dialog"
            aria-modal="true"
            aria-label="¡Encontraste un tesoro!"
            initial={{ opacity: 0, scale: 0.85, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 12 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-5"
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border text-center"
              style={{
                background:
                  "linear-gradient(180deg, #3D2466 0%, #1a0a3a 100%)",
                borderColor: "rgba(77,212,216,0.5)",
                boxShadow:
                  "0 28px 80px -16px rgba(76,29,149,0.65), 0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              {/* CLOSE button (top-right) */}
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-cyan-200 transition-colors hover:bg-white/10"
                style={{ color: "#4DD4D8" }}
              >
                <X className="h-5 w-5" />
              </button>

              {/* TOP · chest + rays + sparkles arena */}
              <div className="relative flex h-56 items-center justify-center overflow-hidden">
                {/* Light rays · 10 radial spokes from chest center */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-1 w-1">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const angle = (360 / 10) * i
                      return (
                        <span
                          key={i}
                          className="nrm-ray absolute left-1/2 top-1/2"
                          style={
                            {
                              "--ray-angle": `${angle}deg`,
                              width: "6px",
                              height: "180px",
                              marginLeft: "-3px",
                              marginTop: "-90px",
                              transformOrigin: "50% 50%",
                              background:
                                "linear-gradient(180deg, rgba(77,212,216,0.95) 0%, rgba(77,212,216,0) 100%)",
                              borderRadius: "3px",
                              filter: "blur(0.3px)",
                            } as React.CSSProperties
                          }
                          aria-hidden
                        />
                      )
                    })}
                  </div>
                </div>

                {/* Sparkles · 12 floating dots at random offsets */}
                <div className="pointer-events-none absolute inset-0">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const sx = Math.cos((i / 12) * Math.PI * 2) * 90
                    const sy = -40 - Math.sin((i / 12) * Math.PI * 2) * 30
                    const delay = `${0.6 + (i % 5) * 0.08}s`
                    return (
                      <span
                        key={i}
                        className="nrm-sparkle absolute left-1/2 top-1/2 block rounded-full"
                        style={
                          {
                            "--sx": `${sx}px`,
                            "--sy": `${sy}px`,
                            "--delay": delay,
                            width: i % 3 === 0 ? "5px" : "3px",
                            height: i % 3 === 0 ? "5px" : "3px",
                            marginLeft: "-2px",
                            marginTop: "-2px",
                            background:
                              i % 3 === 0 ? "#FACC15" : "#4DD4D8",
                            boxShadow:
                              i % 3 === 0
                                ? "0 0 8px rgba(250,204,21,0.9)"
                                : "0 0 8px rgba(77,212,216,0.9)",
                          } as React.CSSProperties
                        }
                        aria-hidden
                      />
                    )
                  })}
                </div>

                {/* Chest SVG · bounces in, lid opens */}
                <ChestSVG />
              </div>

              {/* HEADLINE */}
              <div className="px-6 pb-2 pt-1">
                <div
                  className="font-mono text-[10px] uppercase tracking-[0.28em]"
                  style={{ color: "#4DD4D8" }}
                >
                  · Tesoro descubierto ·
                </div>
                <h2
                  className="mt-1 font-display text-2xl font-semibold leading-tight md:text-3xl"
                  style={{ color: "#FFFFFF" }}
                >
                  ¡Te ganaste{" "}
                  <span style={{ color: "#4DD4D8" }}>{DISCOUNT_PERCENT}%</span>{" "}
                  de descuento!
                </h2>
                <p
                  className="mt-2 text-sm"
                  style={{ color: "rgba(255,255,255,0.7)" }}
                >
                  Usá el código al confirmar tu pedido.
                </p>
              </div>

              {/* CODE CHIP */}
              <div className="px-6 pb-1 pt-4">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="nrm-code-glow group w-full rounded-xl border px-5 py-4 transition-transform hover:translate-y-[-1px] active:translate-y-[1px]"
                  style={{
                    background: "rgba(245, 230, 203, 0.97)",
                    borderColor: "rgba(77,212,216,0.7)",
                  }}
                >
                  <div
                    className="font-mono text-[10px] uppercase tracking-[0.24em]"
                    style={{ color: "#7F1D1D" }}
                  >
                    Código
                  </div>
                  <div
                    id="treasure-code-text"
                    className="mt-1 font-display text-3xl font-bold tracking-[0.18em] tabular-nums"
                    style={{ color: "#4c1d95" }}
                  >
                    {DISCOUNT_CODE}
                  </div>
                  <div
                    className="mt-2 text-xs"
                    style={{ color: copied ? "#14532d" : "#5B3A24" }}
                  >
                    {copied ? "¡Copiado!" : "Toca para copiar"}
                  </div>
                </button>
              </div>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 1.3 }}
                className="flex flex-col gap-2 px-6 pb-6 pt-4 sm:flex-row sm:gap-3"
              >
                <button
                  type="button"
                  onClick={() => {
                    onClose()
                    onOpenMenu()
                  }}
                  className="flex-1 rounded-full bg-gradient-to-r from-[#4DD4D8] to-[#7c3aed] px-5 py-3 font-semibold text-white shadow-lg shadow-violet-500/40 transition-transform hover:translate-y-[-1px]"
                >
                  Ver el menú
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 rounded-full border px-5 py-3 font-medium transition-colors"
                  style={{
                    borderColor: "rgba(77,212,216,0.5)",
                    color: "#4DD4D8",
                    background: "rgba(77,212,216,0.06)",
                  }}
                >
                  Seguir explorando
                </button>
              </motion.div>

              {/* FINEPRINT */}
              <p
                className="px-6 pb-5 text-center text-[10px]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Descuento aplicado automáticamente · válido sobre el
                subtotal de tu pedido por WhatsApp.
              </p>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

/* ─── ChestSVG · stylized treasure chest with opening lid ───────
 *
 * Two SVG groups · base (wood + bands + lock) and lid · so the lid
 * can rotate independently via the `.nrm-lid` keyframe. Colors are
 * deep wood brown for the planks + cyan accents on the bands so it
 * sits cleanly in the Náufrago palette. Inner glow inside the open
 * chest reads as the "treasure light".
 */
function ChestSVG() {
  return (
    <svg
      width="180"
      height="160"
      viewBox="0 0 180 160"
      className="nrm-chest relative z-10 drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
      aria-hidden
    >
      <defs>
        <linearGradient id="chest-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5B3A24" />
          <stop offset="100%" stopColor="#2D1810" />
        </linearGradient>
        <linearGradient id="chest-lid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B452C" />
          <stop offset="100%" stopColor="#3A2818" />
        </linearGradient>
        <radialGradient id="chest-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FACC15" stopOpacity="1" />
          <stop offset="60%" stopColor="#4DD4D8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#4DD4D8" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Interior glow · sits behind the base so light pours out */}
      <ellipse cx="90" cy="92" rx="60" ry="22" fill="url(#chest-glow)" />

      {/* BASE · chest body */}
      <g>
        <rect
          x="20"
          y="78"
          width="140"
          height="62"
          rx="6"
          fill="url(#chest-wood)"
          stroke="#1a0a05"
          strokeWidth="2"
        />
        {/* horizontal cyan band */}
        <rect
          x="20"
          y="106"
          width="140"
          height="6"
          fill="#4DD4D8"
          opacity="0.9"
        />
        {/* vertical bands */}
        <rect x="42" y="78" width="6" height="62" fill="#4DD4D8" opacity="0.9" />
        <rect x="132" y="78" width="6" height="62" fill="#4DD4D8" opacity="0.9" />
        {/* lock plate */}
        <rect
          x="80"
          y="100"
          width="20"
          height="22"
          rx="2"
          fill="#FACC15"
          stroke="#7F1D1D"
          strokeWidth="1.5"
        />
        <circle cx="90" cy="113" r="2.5" fill="#7F1D1D" />
      </g>

      {/* LID · pivots at bottom-left, rotates -90° */}
      <g className="nrm-lid" style={{ transformBox: "fill-box" }}>
        <path
          d="M 20 78 L 20 50 Q 90 22 160 50 L 160 78 Z"
          fill="url(#chest-lid)"
          stroke="#1a0a05"
          strokeWidth="2"
        />
        {/* cyan trim along the curve */}
        <path
          d="M 22 50 Q 90 24 158 50"
          stroke="#4DD4D8"
          strokeWidth="3"
          fill="none"
          opacity="0.85"
        />
      </g>
    </svg>
  )
}
