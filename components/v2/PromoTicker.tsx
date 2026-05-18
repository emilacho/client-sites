"use client"
/**
 * PromoTicker · sticky-bottom TV-news broadcast strip.
 *
 * Round 35 rebuild from the Round 24 single-line Bebas Neue scroll
 * into a 3-band cable-news layout per user reference screenshot:
 *
 *   Band 1 · ALERTA NÁUFRAGO!  headline (red bg, white text)
 *             + pulsing yellow LIVE badge on the right
 *   Band 2 · MARTES 2x1 + COMBO ENCEBOLLADO NÁUFRAGO + JUNIOR GRATIS
 *             (grey bg, black text)
 *             + spinning globe SVG on the right
 *   Band 3 · seamless-loop crawl with delivery details
 *             (red bg, white text)
 *
 * Behavior
 * --------
 *  - 80px tall, full-viewport-wide, fixed at the bottom (z-30)
 *  - Bebas Neue throughout · uppercase + tight tracking
 *  - Crawl scrolls right→left @ ~45 px/s · seamless via -50% loop
 *  - Globe spins 360° every 4s · linear infinite
 *  - LIVE badge + dot pulse opacity 1↔0.6 every 1.2s
 *  - Pause on pointer-enter / touchstart (all animations)
 *  - prefers-reduced-motion halts every animation (text stays
 *    readable, no scroll, no spin, no pulse)
 *  - aria-label aggregates the 3 messages for screen readers
 */
import { useState } from "react"

const HEADLINE = "ALERTA NÁUFRAGO!"
const MIDDLE = "MARTES 2x1 · COMBO ENCEBOLLADO NÁUFRAGO + JUNIOR GRATIS"
const CRAWL =
  "POR LA COMPRA DE UN COMBO ENCEBOLLADO NÁUFRAGO TE REGALAMOS UN ENCEBOLLADO JUNIOR · APROVECHA ESTA PROMOCIÓN · OFERTA SOLO MARTES · DELIVERY OLÓN MONTAÑITA SALINAS"
const CRAWL_SEP = "     ·     "

const NEWS_RED = "#CC0000"
const NEWS_BAND_GREY = "#E5E7EB"
const LIVE_YELLOW = "#FACC15"

export function PromoTicker() {
  const [paused, setPaused] = useState(false)
  const playState = paused ? "paused" : "running"

  return (
    <>
      <style>{`
        @keyframes naufragoCrawl {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes naufragoSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes naufragoLivePulse {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
        .naufrago-crawl    { animation: naufragoCrawl 36s linear infinite; will-change: transform; }
        .naufrago-spin     { animation: naufragoSpin 4s linear infinite;  will-change: transform; }
        .naufrago-live-dot { animation: naufragoLivePulse 1.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .naufrago-crawl    { animation: none; transform: translateX(0); }
          .naufrago-spin     { animation: none; }
          .naufrago-live-dot { animation: none; opacity: 1; }
        }
      `}</style>
      <div
        role="region"
        aria-label={`${HEADLINE} ${MIDDLE} ${CRAWL}`}
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 w-screen overflow-hidden shadow-[0_-4px_16px_rgba(0,0,0,0.45)] select-none"
        style={{
          fontFamily:
            'var(--font-bebas), "Bebas Neue", "Impact", sans-serif',
        }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused((v) => !v)}
      >
        {/* Band 1 · ALERTA NÁUFRAGO!  +  LIVE pulse */}
        <div
          className="flex h-[26px] items-center px-3"
          style={{ background: NEWS_RED }}
        >
          <span
            className="text-white uppercase leading-none"
            style={{ fontSize: "15px", letterSpacing: "0.04em" }}
          >
            {HEADLINE}
          </span>
          <span className="ml-auto flex items-center gap-1.5">
            <span
              aria-hidden
              className="naufrago-live-dot inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: LIVE_YELLOW,
                animationPlayState: playState,
              }}
            />
            <span
              className="uppercase leading-none rounded-sm"
              style={{
                background: LIVE_YELLOW,
                color: "#7F1D1D",
                fontSize: "11px",
                letterSpacing: "0.08em",
                padding: "2px 6px",
                fontWeight: 700,
              }}
            >
              LIVE
            </span>
          </span>
        </div>

        {/* Band 2 · MARTES 2x1 · COMBO + Globe spinning */}
        <div
          className="flex h-[28px] items-center px-3"
          style={{ background: NEWS_BAND_GREY }}
        >
          <span
            className="uppercase leading-none"
            style={{
              color: "#111827",
              fontSize: "16px",
              letterSpacing: "0.02em",
            }}
          >
            {MIDDLE}
          </span>
          <span className="ml-auto flex-shrink-0">
            <svg
              className="naufrago-spin block"
              width="22"
              height="22"
              viewBox="0 0 24 24"
              style={{ animationPlayState: playState }}
              aria-hidden
            >
              {/* Stylised TV globe · blue sphere with red meridians */}
              <circle cx="12" cy="12" r="10" fill="#1E40AF" />
              <ellipse
                cx="12"
                cy="12"
                rx="5"
                ry="10"
                fill="none"
                stroke={NEWS_RED}
                strokeWidth="1"
              />
              <ellipse
                cx="12"
                cy="12"
                rx="10"
                ry="3"
                fill="none"
                stroke={NEWS_RED}
                strokeWidth="0.7"
              />
              <line
                x1="2"
                y1="12"
                x2="22"
                y2="12"
                stroke={NEWS_RED}
                strokeWidth="1"
              />
              <line
                x1="12"
                y1="2"
                x2="12"
                y2="22"
                stroke={NEWS_RED}
                strokeWidth="1"
              />
              <circle
                cx="12"
                cy="12"
                r="10"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="1"
              />
            </svg>
          </span>
        </div>

        {/* Band 3 · scrolling crawl */}
        <div
          className="h-[26px] overflow-hidden"
          style={{ background: NEWS_RED }}
        >
          <div
            aria-hidden
            className="naufrago-crawl flex h-full w-max items-center whitespace-nowrap uppercase leading-none"
            style={{
              color: "#FFFFFF",
              fontSize: "15px",
              letterSpacing: "0.04em",
              animationPlayState: playState,
            }}
          >
            {/* Two identical halves for a seamless −50% loop */}
            <span className="px-6">
              {CRAWL}
              {CRAWL_SEP}
              {CRAWL}
              {CRAWL_SEP}
            </span>
            <span className="px-6" aria-hidden>
              {CRAWL}
              {CRAWL_SEP}
              {CRAWL}
              {CRAWL_SEP}
            </span>
          </div>
        </div>
      </div>
    </>
  )
}
