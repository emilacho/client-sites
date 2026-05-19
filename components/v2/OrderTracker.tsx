"use client"
/**
 * OrderTracker · Round 93 (cuerda + countdown + confettis).
 *
 * Domino's-tracker DNA · grafico persistente del recorrido.
 *  - Canoa (existing R92 OrderJourneyTracker in Scene.tsx) ·
 *    sails island → house · stays as the spatial story.
 *  - Cuerda náutica (R93) · 6 knots horizontal SVG above the
 *    3D scene · always visible while a tracker is open · the
 *    Domino's "5-dot bar" adapted to Náufrago's pirate idiom.
 *  - Status overlay (R92) · top-center handwritten label + ETA ·
 *    no background · ocean reads through.
 *  - Countdown vivo (R93) · ETA ticks down second-by-second in
 *    Caveat handwritten font.
 *  - Coconut confetti (R93) · 36 cocos rain when ENTREGADO ·
 *    plus celebration mode swaps the overlay to thank-you +
 *    star rating + "Pedir de nuevo" CTA.
 *
 * Exports:
 *  - OrderStatus enum
 *  - NAUFRAGO_ORDER_STATUSES (ordered)
 *  - statusToProgress · 0..1 for canoe lerp
 *  - useDemoOrderState · auto-advance demo cadence
 *  - OrderStatusOverlay · top-center label
 *  - RopeTimeline · 6-knots rope above the scene
 *  - CocoConfetti · ENTREGADO celebration sprites
 */
import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

export type OrderStatus =
  | "RECIBIDO"
  | "ACEPTADO"
  | "COCINANDO"
  | "LISTO"
  | "EN_CAMINO"
  | "ENTREGADO"

export const NAUFRAGO_ORDER_STATUSES: OrderStatus[] = [
  "RECIBIDO",
  "ACEPTADO",
  "COCINANDO",
  "LISTO",
  "EN_CAMINO",
  "ENTREGADO",
]

/**
 * Round 94 · canoe-as-courier model. Phases 1-4 happen on the
 * island (the kitchen, the dispatcher, the loading) · the canoe
 * stays parked at its dock the entire time. ONLY when status
 * advances to EN_CAMINO does the canoe physically leave and
 * sail toward the house. ENTREGADO docks it at the house.
 *
 * This matches how every map-based delivery tracker works in
 * production (Uber Eats, Rappi, Glovo, DoorDash, iFood) ·
 * the courier dot is static at the restaurant until pickup ·
 * the visual journey is the delivery, not the lifecycle.
 *
 * The Scene further sub-animates EN_CAMINO over ~25 seconds
 * (time-based lerp inside useFrame) so the canoe glides
 * smoothly rather than jumping mid-stream.
 */
export function statusToProgress(status: OrderStatus): number {
  switch (status) {
    case "RECIBIDO":
    case "ACEPTADO":
    case "COCINANDO":
    case "LISTO":
      return 0
    case "EN_CAMINO":
      return 0.5
    case "ENTREGADO":
      return 1
  }
}

interface StatusCopy {
  id: OrderStatus
  label: string
  detail: string
  emoji: string
}

const COPY: Record<OrderStatus, StatusCopy> = {
  RECIBIDO:  { id: "RECIBIDO",  label: "Recibido",  detail: "Tu pedido llegó al cofre",      emoji: "📩" },
  ACEPTADO:  { id: "ACEPTADO",  label: "Aceptado",  detail: "La cocina lo confirmó",         emoji: "✓"  },
  COCINANDO: { id: "COCINANDO", label: "Cocinando", detail: "Marisco fresco en marcha",      emoji: "🍳" },
  LISTO:     { id: "LISTO",     label: "Listo",     detail: "Empacado · sobre el mesón",     emoji: "🍽️" },
  EN_CAMINO: { id: "EN_CAMINO", label: "En camino", detail: "El canoero salió a tu casa",    emoji: "🛶" },
  ENTREGADO: { id: "ENTREGADO", label: "Entregado", detail: "¡Que aproveche, náufrago!",     emoji: "🎉" },
}

export interface OrderStatusOverlayProps {
  open: boolean
  onClose: () => void
  currentStatus: OrderStatus
  orderCode?: string
  etaMinutes?: number
  /** Called when the user taps a star rating · celebration mode */
  onRate?: (stars: number) => void
  /** Called when the user clicks "Pedir de nuevo" · celebration mode */
  onReorder?: () => void
}

export function OrderStatusOverlay({
  open,
  onClose,
  currentStatus,
  orderCode,
  etaMinutes,
  onRate,
  onReorder,
}: OrderStatusOverlayProps) {
  const copy = COPY[currentStatus]
  const isComplete = currentStatus === "ENTREGADO"

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="ot-overlay"
          role="status"
          aria-live="polite"
          aria-label={`Pedido ${copy.label}`}
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
          className="pointer-events-none fixed left-1/2 top-24 z-40 -translate-x-1/2 text-center"
          style={{
            textShadow:
              "0 2px 12px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95)",
          }}
        >
          {/* Top tiny label · order code + countdown */}
          <div
            className="font-mono uppercase tracking-[0.28em]"
            style={{ color: "#4DD4D8", fontSize: "11px" }}
          >
            {orderCode ?? "NF · pedido"}
            {!isComplete && etaMinutes && etaMinutes > 0 ? (
              <>
                {" · "}
                <CountdownTime seconds={etaMinutes * 60} />
              </>
            ) : null}
          </div>

          {isComplete ? (
            <CelebrationContent onRate={onRate} onReorder={onReorder} />
          ) : (
            <StandardContent copy={copy} />
          )}

          {/* Close button · pointer events re-enabled */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar tracker"
            className="pointer-events-auto mx-auto mt-3 flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-white/15"
            style={{
              color: "rgba(255,255,255,0.75)",
              border: "1px solid rgba(77,212,216,0.4)",
              background: "rgba(0,0,0,0.25)",
              backdropFilter: "blur(4px)",
            }}
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

/* ─── Standard status content · emoji + label + detail ──────── */
function StandardContent({ copy }: { copy: StatusCopy }) {
  return (
    <>
      <div
        className="mt-2 flex items-center justify-center gap-3"
        style={{
          fontFamily:
            'var(--font-bebas), "Bebas Neue", system-ui, sans-serif',
          letterSpacing: "0.05em",
        }}
      >
        <motion.span
          key={copy.id}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
          style={{
            fontSize: "44px",
            filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.8))",
          }}
        >
          {copy.emoji}
        </motion.span>
        <motion.span
          key={`${copy.id}-label`}
          initial={{ x: -8, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4 }}
          style={{ color: "#4DD4D8", fontSize: "42px", lineHeight: 1 }}
        >
          {copy.label}
        </motion.span>
      </div>
      <motion.div
        key={`${copy.id}-detail`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="mt-1"
        style={{
          color: "rgba(255,255,255,0.92)",
          fontSize: "14px",
          fontFamily:
            'var(--font-inter), system-ui, -apple-system, sans-serif',
        }}
      >
        {copy.detail}
      </motion.div>
    </>
  )
}

/* ─── Celebration content · stars + reorder CTA · ENTREGADO ─── */
function CelebrationContent({
  onRate,
  onReorder,
}: {
  onRate?: (s: number) => void
  onReorder?: () => void
}) {
  const [rated, setRated] = useState<number | null>(null)
  const [hover, setHover] = useState(0)
  const stars = [1, 2, 3, 4, 5]
  return (
    <div className="mt-2 flex flex-col items-center gap-2">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        style={{
          fontSize: "44px",
          filter: "drop-shadow(0 4px 16px rgba(0,0,0,0.8))",
        }}
      >
        🎉
      </motion.div>
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{
          fontFamily:
            'var(--font-handwritten), "Homemade Apple", cursive',
          color: "#FACC15",
          fontSize: "36px",
          lineHeight: 1.1,
        }}
      >
        ¡Que aproveche, náufrago!
      </motion.div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.35 }}
        className="pointer-events-auto mt-1 flex items-center gap-1.5"
      >
        {stars.map((s) => {
          const active = (rated ?? hover) >= s
          return (
            <button
              key={s}
              type="button"
              onMouseEnter={() => setHover(s)}
              onMouseLeave={() => setHover(0)}
              onClick={() => {
                setRated(s)
                onRate?.(s)
              }}
              aria-label={`${s} estrellas`}
              style={{
                fontSize: "28px",
                lineHeight: 1,
                color: active ? "#FACC15" : "rgba(255,255,255,0.35)",
                filter: active
                  ? "drop-shadow(0 0 8px rgba(252,211,77,0.7))"
                  : "none",
                transition: "color .15s, filter .15s",
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              ★
            </button>
          )
        })}
      </motion.div>
      {rated !== null ? (
        <motion.button
          type="button"
          onClick={onReorder}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-auto mt-1 rounded-full bg-gradient-to-r from-[#4DD4D8] to-[#7c3aed] px-5 py-2 text-sm font-semibold text-white shadow-md shadow-violet-900/40"
        >
          Pedir de nuevo
        </motion.button>
      ) : null}
    </div>
  )
}

/* ─── Countdown · MM:SS handwritten · ticks every second ────── */
function CountdownTime({ seconds }: { seconds: number }) {
  const [remaining, setRemaining] = useState(seconds)
  // Reset internal counter when the target seconds change (status
  // transitions feed a new etaMinutes value).
  useEffect(() => {
    setRemaining(seconds)
  }, [seconds])
  useEffect(() => {
    if (remaining <= 0) return
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [remaining])
  const mm = Math.floor(remaining / 60)
  const ss = remaining % 60
  const display =
    remaining <= 0
      ? "¡llegando!"
      : `${mm}:${ss.toString().padStart(2, "0")} min`
  return (
    <span
      style={{
        color: remaining <= 180 ? "#FACC15" : "#FACC15",
        fontFamily:
          'var(--font-caveat), "Caveat", "Brush Script MT", cursive',
        fontSize: "16px",
        letterSpacing: "0.02em",
        textTransform: "none",
      }}
    >
      {display}
    </span>
  )
}

/* ─── RopeTimeline · 6 knots on a nautical rope · persistent ── */
export function RopeTimeline({
  open,
  currentStatus,
}: {
  open: boolean
  currentStatus: OrderStatus
}) {
  const activeIdx = NAUFRAGO_ORDER_STATUSES.indexOf(currentStatus)
  // Knot positions along the SVG width · 6 knots, 8% padding each side
  const knots = useMemo(
    () =>
      NAUFRAGO_ORDER_STATUSES.map((id, i) => {
        const x = 8 + (i * (100 - 16)) / (NAUFRAGO_ORDER_STATUSES.length - 1)
        return { id, x, copy: COPY[id] }
      }),
    [],
  )
  const activeX = knots[activeIdx]?.x ?? 8
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="rope"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
          className="pointer-events-none fixed inset-x-0 top-[68px] z-30 px-2"
          aria-hidden
        >
          <svg
            viewBox="0 0 100 22"
            preserveAspectRatio="none"
            className="block h-12 w-full max-w-[1000px] mx-auto"
            style={{
              filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.55))",
            }}
          >
            {/* Inactive rope · braided look via dashed stroke */}
            <path
              d="M 8 12 Q 25 8 50 12 T 92 12"
              stroke="rgba(139,96,52,0.9)"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="1.2 0.8"
            />
            {/* Active rope · celeste, trimmed to current progress */}
            <defs>
              <clipPath id="active-rope-clip">
                <rect x="0" y="0" width={activeX} height="22" />
              </clipPath>
            </defs>
            <path
              d="M 8 12 Q 25 8 50 12 T 92 12"
              stroke="#4DD4D8"
              strokeWidth="2.2"
              fill="none"
              strokeLinecap="round"
              strokeDasharray="1.2 0.8"
              clipPath="url(#active-rope-clip)"
            />

            {/* Knots */}
            {knots.map((k, i) => {
              const status: "complete" | "active" | "pending" =
                i < activeIdx ? "complete" : i === activeIdx ? "active" : "pending"
              const cy = 12 + (i % 2 === 0 ? -0.6 : 0.6) // tiny wave offset
              return (
                <KnotMark key={k.id} cx={k.x} cy={cy} status={status} />
              )
            })}
          </svg>
          {/* Knot labels · below the rope · Bebas Neue uppercase */}
          <div className="mx-auto mt-1 grid max-w-[1000px] grid-cols-6 px-2 text-center">
            {knots.map((k, i) => {
              const status: "complete" | "active" | "pending" =
                i < activeIdx ? "complete" : i === activeIdx ? "active" : "pending"
              const color =
                status === "active"
                  ? "#FACC15"
                  : status === "complete"
                    ? "#4DD4D8"
                    : "rgba(255,255,255,0.45)"
              return (
                <span
                  key={k.id}
                  className="font-mono uppercase"
                  style={{
                    color,
                    fontSize: "9px",
                    letterSpacing: "0.18em",
                    textShadow:
                      "0 1px 4px rgba(0,0,0,0.85), 0 0 2px rgba(0,0,0,0.95)",
                  }}
                >
                  {k.copy.label}
                </span>
              )
            })}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}

function KnotMark({
  cx,
  cy,
  status,
}: {
  cx: number
  cy: number
  status: "complete" | "active" | "pending"
}) {
  const color =
    status === "active"
      ? "#FACC15"
      : status === "complete"
        ? "#4DD4D8"
        : "rgba(255,255,255,0.35)"
  return (
    <g>
      {status === "active" ? (
        <motion.circle
          cx={cx}
          cy={cy}
          r="3.2"
          fill="rgba(252,211,77,0.25)"
          animate={{ r: [3.2, 4.2, 3.2] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        />
      ) : null}
      <circle
        cx={cx}
        cy={cy}
        r="1.6"
        fill={color}
        stroke="rgba(58,40,24,0.85)"
        strokeWidth="0.4"
      />
    </g>
  )
}

/* ─── CocoConfetti · 36 cocos rain on ENTREGADO ─────────────── */
export function CocoConfetti({ active }: { active: boolean }) {
  // Stable random offsets per piece · regenerated only when active
  // flips true (so re-renders during the fall don't reshuffle).
  const pieces = useMemo(() => {
    if (!active) return [] as Array<{
      id: number
      left: number
      delay: number
      duration: number
      rotateStart: number
      rotateEnd: number
      size: number
      emoji: string
    }>
    const palette = ["🥥", "🌴", "⭐", "✨"]
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.5,
      duration: 2.4 + Math.random() * 2.2,
      rotateStart: Math.random() * 360,
      rotateEnd: Math.random() * 720 - 360,
      size: 18 + Math.random() * 18,
      emoji: palette[Math.floor(Math.random() * palette.length)],
    }))
  }, [active])

  return (
    <AnimatePresence>
      {active ? (
        <div
          key="confetti"
          className="pointer-events-none fixed inset-0 z-40 overflow-hidden"
          aria-hidden
        >
          {pieces.map((p) => (
            <motion.span
              key={p.id}
              initial={{
                top: -60,
                opacity: 0,
                rotate: p.rotateStart,
              }}
              animate={{
                top: "110%",
                opacity: [0, 1, 1, 0],
                rotate: p.rotateEnd,
              }}
              transition={{
                duration: p.duration,
                delay: p.delay,
                ease: "linear",
                times: [0, 0.1, 0.85, 1],
              }}
              style={{
                position: "absolute",
                left: `${p.left}%`,
                fontSize: `${p.size}px`,
                filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.4))",
              }}
            >
              {p.emoji}
            </motion.span>
          ))}
        </div>
      ) : null}
    </AnimatePresence>
  )
}

/**
 * Demo state machine · auto-advance through the 6 stages for
 * a visual preview. Round 96 replaces this with a real Supabase
 * subscription.
 */
export function useDemoOrderState(active: boolean): OrderStatus {
  const [status, setStatus] = useState<OrderStatus>("RECIBIDO")
  useEffect(() => {
    if (!active) return
    setStatus("RECIBIDO")
    const timers: number[] = []
    // Round 94 · re-balanced cadence so COCINANDO (smoke puffs)
    // and LISTO (package loading) have room to read · EN_CAMINO
    // sub-animates 25s internally so we hold the status long
    // enough to let the canoe finish the journey before going
    // to ENTREGADO.
    const schedule: { at: number; status: OrderStatus }[] = [
      { at: 1800, status: "ACEPTADO" },
      { at: 4500, status: "COCINANDO" },
      { at: 14000, status: "LISTO" },
      { at: 19000, status: "EN_CAMINO" },
      { at: 44000, status: "ENTREGADO" },
    ]
    for (const s of schedule) {
      const id = window.setTimeout(() => setStatus(s.status), s.at)
      timers.push(id)
    }
    return () => {
      for (const id of timers) window.clearTimeout(id)
    }
  }, [active])
  return status
}
