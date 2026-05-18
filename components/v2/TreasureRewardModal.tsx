"use client"
/**
 * TreasureRewardModal · Round 77 · refactored R79.
 *
 * Sequenced treasure reveal · the chest opens FIRST, then an
 * explosion burst (confetti + rays + flash) erupts, then a
 * pirate-scroll pergamino rises out of the chest carrying the
 * NAUFRAGO5 5% off message.
 *
 * Sequence (cumulative ms after open):
 *   0    backdrop fades in (transparent post-R78 · isla visible)
 *   150  ChestSVG bounces in
 *   750  Lid swings open · the chest is now "ready"
 *   1150 EXPLOSION · flash + 16 rays + 12 sparkles + 14 confetti
 *        bits burst outward
 *   1550 Pergamino scroll rises from inside the chest, unrolls
 *        upward, headline + code visible
 *   2200 CTAs fade in below the scroll
 *
 * Náufrago palette · panel violet #3D2466 / celeste #4DD4D8 ·
 * gold #FACC15 on the burst + chest details · pergamino cream
 * #F5E6CB with wine-red #7F1D1D pirate type.
 */
import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"

const DISCOUNT_CODE = "NAUFRAGO5"
const DISCOUNT_PERCENT = 5

// Cumulative timeline offsets (seconds) · used by both the CSS
// keyframe delays and the framer transition.delay values so the
// two animation systems stay in lockstep.
const T_CHEST = 0.15
const T_LID = 0.75
const T_EXPLOSION = 1.15
const T_SCROLL = 1.55
const T_CTAS = 2.2

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

  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  // Auto-apply the discount when the modal opens · the customer
  // gets the treasure even if they never copy / never read.
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
          <style>{`
            /* ─── Chest entrance + lid ───────────────────────── */
            @keyframes nrmChestBounce {
              0%   { transform: scale(0.3) translateY(40px); opacity: 0; }
              60%  { transform: scale(1.08) translateY(-6px); opacity: 1; }
              80%  { transform: scale(0.96) translateY(2px); }
              100% { transform: scale(1.00) translateY(0); }
            }
            @keyframes nrmLidOpen {
              0%   { transform: rotate(0deg); }
              100% { transform: rotate(-95deg); }
            }
            .nrm-chest {
              animation: nrmChestBounce 700ms cubic-bezier(.34,1.56,.64,1) ${T_CHEST}s 1 both;
            }
            .nrm-lid {
              animation: nrmLidOpen 480ms cubic-bezier(.34,1.56,.64,1) ${T_LID}s 1 both;
              transform-origin: 16% 100%;
              transform-box: fill-box;
            }

            /* ─── EXPLOSION at T_EXPLOSION ───────────────────── */
            @keyframes nrmFlash {
              0%   { opacity: 0;   transform: scale(0.2); }
              40%  { opacity: 0.9; transform: scale(1.0); }
              100% { opacity: 0;   transform: scale(1.6); }
            }
            @keyframes nrmRayBurst {
              0%   { transform: rotate(var(--ray-angle)) scaleY(0); opacity: 0; }
              25%  { opacity: 1; }
              100% { transform: rotate(var(--ray-angle)) scaleY(1); opacity: 0; }
            }
            @keyframes nrmConfetti {
              0%   { transform: translate(0, 0) rotate(0deg);                        opacity: 0; }
              20%  { opacity: 1; }
              100% { transform: translate(var(--cx), var(--cy)) rotate(var(--cr)); opacity: 0; }
            }
            @keyframes nrmSparkleBurst {
              0%   { transform: translate(0, 0) scale(0);   opacity: 0; }
              30%  { transform: translate(var(--sx), var(--sy)) scale(1.1); opacity: 1; }
              100% { transform: translate(var(--sx), var(--sy)) scale(0.2); opacity: 0; }
            }
            .nrm-flash    { animation: nrmFlash 700ms ease-out ${T_EXPLOSION}s 1 forwards; }
            .nrm-ray      { animation: nrmRayBurst 1100ms ease-out ${T_EXPLOSION}s 1 forwards; }
            .nrm-confetti { animation: nrmConfetti 1400ms cubic-bezier(.22,.61,.36,1) ${T_EXPLOSION}s 1 forwards; }
            .nrm-sparkle  { animation: nrmSparkleBurst 1500ms ease-out var(--delay, ${T_EXPLOSION}s) 1 forwards; }

            /* ─── Pergamino rises + unrolls ──────────────────── */
            @keyframes nrmScrollRise {
              0%   { transform: translateY(60px) scaleY(0.05); opacity: 0; }
              20%  { opacity: 1; }
              55%  { transform: translateY(-40px) scaleY(1.06); }
              80%  { transform: translateY(-58px) scaleY(0.98); }
              100% { transform: translateY(-62px) scaleY(1.00); opacity: 1; }
            }
            .nrm-scroll {
              animation: nrmScrollRise 750ms cubic-bezier(.34,1.4,.64,1) ${T_SCROLL}s 1 both;
              transform-origin: 50% 100%;
            }

            /* ─── Pergamino glow pulse (post-rise) ───────────── */
            @keyframes nrmScrollGlow {
              0%, 100% { filter: drop-shadow(0 6px 14px rgba(127,29,29,0.35)); }
              50%      { filter: drop-shadow(0 6px 18px rgba(77,212,216,0.55)); }
            }
            .nrm-scroll-glow {
              animation: nrmScrollGlow 2800ms ease-in-out ${T_SCROLL + 0.8}s infinite;
            }

            @media (prefers-reduced-motion: reduce) {
              .nrm-chest, .nrm-lid,
              .nrm-flash, .nrm-ray, .nrm-confetti, .nrm-sparkle,
              .nrm-scroll, .nrm-scroll-glow {
                animation: none !important;
              }
            }
          `}</style>

          {/* BACKDROP · invisible · click-to-close · isla visible (R78) */}
          <motion.div
            key="treasure-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50"
            style={{ background: "transparent" }}
            aria-hidden
          />

          {/* PANEL · centered card · the only opaque surface */}
          <motion.div
            key="treasure-panel"
            role="dialog"
            aria-modal="true"
            aria-label="¡Encontraste un tesoro!"
            initial={{ opacity: 0, scale: 0.9, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 10 }}
            transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-0 z-50 flex items-center justify-center p-5"
          >
            <div
              className="relative w-full max-w-md overflow-hidden rounded-2xl border"
              style={{
                background:
                  "linear-gradient(180deg, #3D2466 0%, #1a0a3a 100%)",
                borderColor: "rgba(77,212,216,0.5)",
                boxShadow:
                  "0 28px 80px -16px rgba(76,29,149,0.65), 0 12px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                style={{ color: "#4DD4D8" }}
              >
                <X className="h-5 w-5" />
              </button>

              {/* ARENA · chest + explosion + scroll all share this
                  space so the scroll visually rises FROM the chest
                  opening. Height tall enough for the unrolled
                  pergamino plus the chest below it. */}
              <div className="relative h-[360px] overflow-hidden">
                {/* CHEST · sits anchored bottom-center */}
                <div className="absolute inset-x-0 bottom-3 flex items-end justify-center">
                  <ChestSVG />
                </div>

                {/* FLASH · burst of white at T_EXPLOSION · sits in
                    front of the chest, behind the scroll */}
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div
                    className="nrm-flash absolute"
                    style={{
                      width: "300px",
                      height: "300px",
                      bottom: "60px",
                      borderRadius: "9999px",
                      background:
                        "radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(252,211,77,0.6) 35%, rgba(77,212,216,0.0) 70%)",
                      mixBlendMode: "screen",
                    }}
                    aria-hidden
                  />
                </div>

                {/* RAYS · 16 spokes from the chest opening */}
                <div className="pointer-events-none absolute inset-0">
                  <div className="absolute left-1/2 bottom-[110px] h-1 w-1">
                    {Array.from({ length: 16 }).map((_, i) => {
                      const angle = (360 / 16) * i
                      return (
                        <span
                          key={i}
                          className="nrm-ray absolute left-1/2 top-1/2"
                          style={
                            {
                              "--ray-angle": `${angle}deg`,
                              width: "5px",
                              height: "180px",
                              marginLeft: "-2.5px",
                              marginTop: "-90px",
                              transformOrigin: "50% 100%",
                              background:
                                "linear-gradient(180deg, rgba(77,212,216,0) 0%, rgba(77,212,216,0.95) 50%, rgba(252,211,77,0.95) 100%)",
                              borderRadius: "3px",
                            } as React.CSSProperties
                          }
                          aria-hidden
                        />
                      )
                    })}
                  </div>
                </div>

                {/* CONFETTI · 14 rotating chips in brand + treasure */}
                <div className="pointer-events-none absolute inset-0">
                  {Array.from({ length: 14 }).map((_, i) => {
                    const angle = (i / 14) * Math.PI * 2
                    const dist = 90 + (i % 3) * 25
                    const cx = Math.cos(angle) * dist
                    const cy = -(20 + Math.sin(angle) * 60)
                    const cr = (i % 2 ? 1 : -1) * (180 + (i % 3) * 90)
                    const palette = ["#4DD4D8", "#FACC15", "#F5E6CB", "#7c3aed"]
                    const color = palette[i % palette.length]
                    return (
                      <span
                        key={i}
                        className="nrm-confetti absolute left-1/2"
                        style={
                          {
                            "--cx": `${cx}px`,
                            "--cy": `${cy}px`,
                            "--cr": `${cr}deg`,
                            bottom: "110px",
                            width: i % 2 ? "7px" : "9px",
                            height: i % 2 ? "11px" : "5px",
                            marginLeft: i % 2 ? "-3.5px" : "-4.5px",
                            background: color,
                            borderRadius: "1.5px",
                            boxShadow: `0 0 6px ${color}80`,
                          } as React.CSSProperties
                        }
                        aria-hidden
                      />
                    )
                  })}
                </div>

                {/* SPARKLES · 12 small floating dots, staggered */}
                <div className="pointer-events-none absolute inset-0">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const sx = Math.cos((i / 12) * Math.PI * 2) * 110
                    const sy = -(60 + Math.sin((i / 12) * Math.PI * 2) * 50)
                    const delay = `${T_EXPLOSION + (i % 5) * 0.07}s`
                    const isGold = i % 3 === 0
                    return (
                      <span
                        key={i}
                        className="nrm-sparkle absolute left-1/2"
                        style={
                          {
                            "--sx": `${sx}px`,
                            "--sy": `${sy}px`,
                            "--delay": delay,
                            bottom: "120px",
                            width: isGold ? "6px" : "4px",
                            height: isGold ? "6px" : "4px",
                            marginLeft: isGold ? "-3px" : "-2px",
                            background: isGold ? "#FACC15" : "#4DD4D8",
                            borderRadius: "9999px",
                            boxShadow: isGold
                              ? "0 0 10px rgba(250,204,21,0.9)"
                              : "0 0 10px rgba(77,212,216,0.9)",
                          } as React.CSSProperties
                        }
                        aria-hidden
                      />
                    )
                  })}
                </div>

                {/* PERGAMINO · rises from inside the chest opening.
                    Anchored at chest hinge Y (bottom of arena) and
                    animated translateY upward + scaleY 0 → 1. */}
                <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex justify-center">
                  <div className="nrm-scroll nrm-scroll-glow mt-3">
                    <PergaminoScroll
                      code={DISCOUNT_CODE}
                      percent={DISCOUNT_PERCENT}
                      copied={copied}
                      onCopy={handleCopy}
                    />
                  </div>
                </div>
              </div>

              {/* CTAs · below the arena */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: T_CTAS }}
                className="flex flex-col gap-2 px-6 pb-6 pt-2 sm:flex-row sm:gap-3"
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

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: T_CTAS + 0.1 }}
                className="px-6 pb-5 text-center text-[10px]"
                style={{ color: "rgba(255,255,255,0.45)" }}
              >
                Descuento aplicado automáticamente · válido sobre el
                subtotal de tu pedido por WhatsApp.
              </motion.p>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

/* ─── ChestSVG ────────────────────────────────────────────────── */
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
        <linearGradient id="chest-wood-r79" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5B3A24" />
          <stop offset="100%" stopColor="#2D1810" />
        </linearGradient>
        <linearGradient id="chest-lid-r79" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B452C" />
          <stop offset="100%" stopColor="#3A2818" />
        </linearGradient>
        <radialGradient id="chest-glow-r79" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#FACC15" stopOpacity="1" />
          <stop offset="60%" stopColor="#4DD4D8" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#4DD4D8" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="90" cy="92" rx="60" ry="22" fill="url(#chest-glow-r79)" />

      {/* BASE */}
      <g>
        <rect
          x="20" y="78" width="140" height="62" rx="6"
          fill="url(#chest-wood-r79)"
          stroke="#1a0a05" strokeWidth="2"
        />
        <rect x="20" y="106" width="140" height="6" fill="#4DD4D8" opacity="0.9" />
        <rect x="42" y="78"  width="6"   height="62" fill="#4DD4D8" opacity="0.9" />
        <rect x="132" y="78" width="6"   height="62" fill="#4DD4D8" opacity="0.9" />
        <rect x="80" y="100" width="20"  height="22" rx="2"
              fill="#FACC15" stroke="#7F1D1D" strokeWidth="1.5" />
        <circle cx="90" cy="113" r="2.5" fill="#7F1D1D" />
      </g>

      {/* LID · pivots on the back-left hinge */}
      <g className="nrm-lid">
        <path
          d="M 20 78 L 20 50 Q 90 22 160 50 L 160 78 Z"
          fill="url(#chest-lid-r79)"
          stroke="#1a0a05" strokeWidth="2"
        />
        <path
          d="M 22 50 Q 90 24 158 50"
          stroke="#4DD4D8" strokeWidth="3"
          fill="none" opacity="0.85"
        />
      </g>
    </svg>
  )
}

/* ─── PergaminoScroll · pirate parchment with the code ──────────
 *
 * A vertical parchment with rolled top + bottom edges, aged cream
 * tone, wine-red border line, and the discount headline + code.
 * Whole component clickable to trigger the copy handler.
 */
function PergaminoScroll({
  code,
  percent,
  copied,
  onCopy,
}: {
  code: string
  percent: number
  copied: boolean
  onCopy: () => void
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className="pointer-events-auto relative block w-[300px] active:translate-y-[1px]"
      style={{ background: "transparent", border: "none", padding: 0 }}
      aria-label={`Copiar código ${code}`}
    >
      <svg
        width="300"
        height="220"
        viewBox="0 0 300 220"
        className="block"
        aria-hidden
      >
        <defs>
          <linearGradient id="pergamino-body" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#F5E6CB" />
            <stop offset="50%" stopColor="#EFD9B0" />
            <stop offset="100%" stopColor="#E2C290" />
          </linearGradient>
          <linearGradient id="pergamino-roll" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#8B6034" />
            <stop offset="50%"  stopColor="#5B3A24" />
            <stop offset="100%" stopColor="#3D2410" />
          </linearGradient>
          <radialGradient id="pergamino-vignette" cx="0.5" cy="0.5" r="0.7">
            <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
            <stop offset="70%"  stopColor="rgba(74,42,26,0.05)" />
            <stop offset="100%" stopColor="rgba(74,42,26,0.30)" />
          </radialGradient>
        </defs>

        {/* PARCHMENT BODY · rectangle with subtle aged edges */}
        <rect
          x="22" y="34"
          width="256" height="152"
          rx="4"
          fill="url(#pergamino-body)"
          stroke="#7F1D1D"
          strokeOpacity="0.35"
          strokeWidth="1.2"
        />
        {/* Vignette overlay so edges read aged */}
        <rect
          x="22" y="34"
          width="256" height="152"
          rx="4"
          fill="url(#pergamino-vignette)"
        />
        {/* Top inner border line */}
        <line x1="40" y1="58"  x2="260" y2="58"
              stroke="#7F1D1D" strokeOpacity="0.4" strokeWidth="1" />
        {/* Bottom inner border line */}
        <line x1="40" y1="162" x2="260" y2="162"
              stroke="#7F1D1D" strokeOpacity="0.4" strokeWidth="1" />

        {/* TOP ROLL · cylinder */}
        <rect
          x="10" y="20"
          width="280" height="22"
          rx="11"
          fill="url(#pergamino-roll)"
          stroke="#2D1810"
          strokeWidth="1.5"
        />
        {/* tiny end-caps highlight */}
        <ellipse cx="22"  cy="31" rx="6" ry="9" fill="#3A2310" />
        <ellipse cx="278" cy="31" rx="6" ry="9" fill="#3A2310" />

        {/* BOTTOM ROLL */}
        <rect
          x="10" y="178"
          width="280" height="22"
          rx="11"
          fill="url(#pergamino-roll)"
          stroke="#2D1810"
          strokeWidth="1.5"
        />
        <ellipse cx="22"  cy="189" rx="6" ry="9" fill="#3A2310" />
        <ellipse cx="278" cy="189" rx="6" ry="9" fill="#3A2310" />

        {/* TEXT · pirate flavor */}
        <text
          x="150" y="76"
          textAnchor="middle"
          fontSize="9.5"
          letterSpacing="3"
          fontFamily="ui-monospace, Menlo, monospace"
          fill="#5B3A24"
        >
          · TESORO HALLADO ·
        </text>

        <text
          x="150" y="105"
          textAnchor="middle"
          fontSize="22"
          fontWeight="700"
          fontFamily="var(--font-display), Georgia, serif"
          fill="#7F1D1D"
        >
          {percent}% de descuento
        </text>

        <text
          x="150" y="124"
          textAnchor="middle"
          fontSize="10"
          fontFamily="ui-monospace, Menlo, monospace"
          fill="#5B3A24"
        >
          usá el código al cerrar tu pedido
        </text>

        {/* Code chip · cream inside parchment */}
        <rect
          x="60" y="134"
          width="180" height="32"
          rx="4"
          fill="#FFFFFF"
          fillOpacity="0.55"
          stroke="#7F1D1D"
          strokeWidth="1.2"
        />
        <text
          id="treasure-code-text"
          x="150" y="156"
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          letterSpacing="3.5"
          fontFamily="var(--font-display), Georgia, serif"
          fill="#4c1d95"
        >
          {code}
        </text>

        {/* tap-hint or copied feedback */}
        <text
          x="150" y="178"
          textAnchor="middle"
          fontSize="8"
          letterSpacing="1.5"
          fontFamily="ui-monospace, Menlo, monospace"
          fill={copied ? "#14532d" : "#5B3A24"}
        >
          {copied ? "¡COPIADO!" : "TOCA EL PERGAMINO PARA COPIAR"}
        </text>
      </svg>
    </button>
  )
}
