"use client"
/**
 * PromoTicker · sticky-bottom marquee announcing the current promo.
 *
 * Round 19 single-issue add. Replaces the previous MenuQuickAdd bottom
 * strip · the cofre/MenuModal flow now owns ordering, so the bottom
 * real-estate is free for a high-visibility promo announcement.
 *
 * Behavior
 * --------
 *  - 50px tall, full-viewport-wide, fixed at the bottom (z-30 so it
 *    sits below TopBar but above the 3D scene)
 *  - Continuous right→left scroll · seamless via two identical text
 *    copies inside the track and `transform: translateX(0 → -50%)`
 *  - Speed ≈ 45 px/s · duration tuned to text width so the cycle
 *    completes a clean loop
 *  - Pause on pointer-enter / touchstart · resume on leave / next tap
 *  - `prefers-reduced-motion` halts the animation (still readable)
 *
 * The promo text is the canonical Náufrago Martes 2x1 message · DO NOT
 * modify the string (per dispatch Round 19). Color #FF3B30 is the iOS
 * system-red, deliberately loud against the dark slate strip.
 */
import { useState } from "react"

const PROMO_TEXT =
  "ALERTA NÁUFRAGO! : MARTES 2x1. POR LA COMPRA DE UN COMBO ENCEBOLLADO NÁUFRAGO TE REGALAMOS UN ENCEBOLLADO JUNIOR. APROVECHA ESTA PROMOCION !!!"
const SEPARATOR = "   •   "

export function PromoTicker() {
  const [paused, setPaused] = useState(false)

  return (
    <>
      <style>{`
        @keyframes naufragoPromoMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .naufrago-promo-track {
          animation: naufragoPromoMarquee 36s linear infinite;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .naufrago-promo-track {
            animation: none;
            transform: translateX(0);
          }
        }
      `}</style>
      <div
        role="region"
        aria-label={PROMO_TEXT}
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 h-[50px] w-screen overflow-hidden border-t bg-slate-950/95 shadow-[0_-2px_24px_rgba(77,212,216,0.18)] backdrop-blur-sm"
        style={{ borderTopColor: "rgba(77, 212, 216, 0.6)" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused((v) => !v)}
      >
        <div
          aria-hidden
          className="naufrago-promo-track flex h-full w-max items-center whitespace-nowrap text-[17px] font-bold uppercase tracking-wide select-none"
          style={{
            color: "#FF3B30",
            fontFamily: 'var(--font-marker), "Permanent Marker", cursive',
            animationPlayState: paused ? "paused" : "running",
            textShadow: "0 1px 0 rgba(0,0,0,0.4)",
          }}
        >
          {/* Two identical copies for a seamless -50% loop · the
              translate moves exactly one copy width per cycle. */}
          <span className="px-12">
            {PROMO_TEXT}
            {SEPARATOR}
            {PROMO_TEXT}
          </span>
          <span className="px-12" aria-hidden>
            {PROMO_TEXT}
            {SEPARATOR}
            {PROMO_TEXT}
          </span>
        </div>
      </div>
    </>
  )
}
