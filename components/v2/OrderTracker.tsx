"use client"
/**
 * OrderTracker · Round 91.
 *
 * Domino's-pizza-tracker-style 6-step visual of a Náufrago order
 * in flight. Mounts as a slide-up bottom-sheet (mobile) /
 * floating right-panel (desktop). Each step has its own icon,
 * label, ETA, and active-state animation (celeste pulse).
 *
 * State machine:
 *   RECIBIDO  → ACEPTADO → COCINANDO → LISTO → EN_CAMINO → ENTREGADO
 *
 * Visual treatment per step:
 *   complete · #4DD4D8 (celeste · filled)
 *   active   · #FACC15 (gold pulse · "está pasando ahora")
 *   pending  · slate-700 (gray · "aún no")
 *
 * The component is pure presentation · it doesn't talk to APIs.
 * Round 92+ wires it to a real order row in Supabase pulled
 * server-side. For demo / preview, parent passes `currentStatus`
 * + optional `orderCode` + `etaMinutes` directly.
 *
 * Náufrago palette · celeste #4DD4D8, gold #FACC15, violet
 * #4c1d95 bg, slate body. Bebas Neue for step labels (matches
 * the PromoTicker family), Caveat for the optional rider note
 * (handwritten castaway voice).
 */
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X } from "lucide-react"

export type OrderStatus =
  | "RECIBIDO"
  | "ACEPTADO"
  | "COCINANDO"
  | "LISTO"
  | "EN_CAMINO"
  | "ENTREGADO"

interface Step {
  id: OrderStatus
  label: string
  detail: string
  // Inline SVG icon path (24×24 viewBox) so we don't ship an icon
  // font · keeps the bundle tight.
  icon: React.ReactNode
}

const STEPS: Step[] = [
  {
    id: "RECIBIDO",
    label: "Recibido",
    detail: "Tu pedido llegó al cofre",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <path d="M5 8 L19 8 L18 19 Q18 20 17 20 L7 20 Q6 20 6 19 Z" />
        <path d="M9 8 V6 Q9 4 12 4 Q15 4 15 6 V8" />
      </svg>
    ),
  },
  {
    id: "ACEPTADO",
    label: "Aceptado",
    detail: "La cocina lo confirmó",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12 L11 15 L16 9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "COCINANDO",
    label: "Cocinando",
    detail: "Marisco fresco en marcha",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <path d="M4 14 H20 V17 Q20 20 17 20 H7 Q4 20 4 17 Z" />
        <path d="M8 14 V11 Q8 7 12 7 Q16 7 16 11 V14" />
        <path d="M10 4 Q10 6 12 6 Q14 6 14 4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "LISTO",
    label: "Listo",
    detail: "Sobre el mesón · empacando",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <rect x="4" y="7" width="16" height="13" rx="1" />
        <path d="M4 11 H20" />
        <path d="M9 7 V4 H15 V7" />
      </svg>
    ),
  },
  {
    id: "EN_CAMINO",
    label: "En camino",
    detail: "El rider salió a tu puerta",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <circle cx="6" cy="17" r="3" />
        <circle cx="18" cy="17" r="3" />
        <path d="M9 17 H14 L17 11 H11 L9 14 Z" />
        <path d="M14 11 L13 7 H10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "ENTREGADO",
    label: "Entregado",
    detail: "¡Que aproveche, náufrago!",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor">
        <path d="M12 21 S5 14 5 9 Q5 5 9 5 Q11 5 12 7 Q13 5 15 5 Q19 5 19 9 Q19 14 12 21 Z" />
      </svg>
    ),
  },
]

const STATUS_ORDER: OrderStatus[] = STEPS.map((s) => s.id)
export const NAUFRAGO_ORDER_STATUSES = STATUS_ORDER

export interface OrderTrackerProps {
  open: boolean
  onClose: () => void
  /** Current step in the machine. Pre-step state shows the panel
   *  with all 6 in pending. */
  currentStatus: OrderStatus
  /** Short user-facing order code · "NF-1827" style */
  orderCode?: string
  /** Minutes until the rider hits the dropoff · used by the
   *  active step subtitle ("estimado · 12 min"). */
  etaMinutes?: number
  /** Optional handwritten note from the rider · shows on top
   *  when status is EN_CAMINO or later. */
  riderNote?: string
}

export function OrderTracker({
  open,
  onClose,
  currentStatus,
  orderCode,
  etaMinutes,
  riderNote,
}: OrderTrackerProps) {
  const activeIdx = STATUS_ORDER.indexOf(currentStatus)
  const isComplete = currentStatus === "ENTREGADO"

  // ESC dismiss
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
        <>
          {/* Backdrop · semi-transparent · click closes */}
          <motion.div
            key="ot-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm"
            aria-hidden
          />

          {/* Panel · slide-up bottom-sheet on mobile, right-anchored card on desktop */}
          <motion.div
            key="ot-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Tu pedido en curso"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3 md:inset-x-auto md:bottom-auto md:right-6 md:top-20 md:px-0"
          >
            <div
              className="w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl"
              style={{
                background:
                  "linear-gradient(180deg, rgba(76,29,149,0.96) 0%, rgba(15,23,42,0.97) 100%)",
                borderColor: "rgba(77,212,216,0.45)",
                boxShadow:
                  "0 24px 60px -16px rgba(76,29,149,0.6), 0 12px 32px rgba(0,0,0,0.5)",
              }}
            >
              {/* Header · code + ETA + close */}
              <div className="flex items-start justify-between gap-4 border-b border-cyan-500/15 px-5 py-4">
                <div>
                  <div
                    className="font-mono text-[10px] uppercase tracking-[0.22em]"
                    style={{ color: "#4DD4D8" }}
                  >
                    Pedido en curso
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span
                      className="font-display text-2xl font-semibold text-white"
                      style={{ letterSpacing: "0.02em" }}
                    >
                      {orderCode ?? "NF-NÁUFRAGO"}
                    </span>
                    {!isComplete && etaMinutes ? (
                      <span
                        className="text-xs"
                        style={{ color: "rgba(77,212,216,0.85)" }}
                      >
                        · ~{etaMinutes} min
                      </span>
                    ) : null}
                  </div>
                  {isComplete ? (
                    <div
                      className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em]"
                      style={{ color: "#FACC15" }}
                    >
                      Completo
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Cerrar"
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Rider handwritten note (only when in flight) */}
              {riderNote &&
              (currentStatus === "EN_CAMINO" || currentStatus === "ENTREGADO") ? (
                <div
                  className="border-b border-cyan-500/15 px-5 py-3 text-sm italic"
                  style={{
                    color: "#FAEBC8",
                    fontFamily:
                      'var(--font-caveat), "Caveat", "Brush Script MT", cursive',
                    fontSize: "18px",
                  }}
                >
                  “{riderNote}”
                </div>
              ) : null}

              {/* Steps · vertical timeline */}
              <ol className="space-y-0 px-2 py-2">
                {STEPS.map((step, i) => {
                  const status: "complete" | "active" | "pending" =
                    i < activeIdx ? "complete" : i === activeIdx ? "active" : "pending"
                  const isLast = i === STEPS.length - 1
                  return (
                    <Step
                      key={step.id}
                      step={step}
                      status={status}
                      isLast={isLast}
                    />
                  )
                })}
              </ol>

              {/* Footer · subtle hint */}
              <div className="border-t border-cyan-500/15 px-5 py-3 text-center">
                <p
                  className="text-[11px]"
                  style={{ color: "rgba(255,255,255,0.5)" }}
                >
                  Esto se actualiza solo · podés cerrar y volver cuando quieras.
                </p>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )
}

function Step({
  step,
  status,
  isLast,
}: {
  step: Step
  status: "complete" | "active" | "pending"
  isLast: boolean
}) {
  const colors = {
    complete: {
      iconBg: "#4DD4D8",
      iconFg: "#0a0a0f",
      label: "#FFFFFF",
      detail: "rgba(255,255,255,0.55)",
      connector: "#4DD4D8",
    },
    active: {
      iconBg: "#FACC15",
      iconFg: "#0a0a0f",
      label: "#FACC15",
      detail: "rgba(252,211,77,0.85)",
      connector: "rgba(252,211,77,0.4)",
    },
    pending: {
      iconBg: "rgba(255,255,255,0.06)",
      iconFg: "rgba(255,255,255,0.35)",
      label: "rgba(255,255,255,0.55)",
      detail: "rgba(255,255,255,0.35)",
      connector: "rgba(255,255,255,0.10)",
    },
  }[status]

  return (
    <li className="relative flex gap-4 px-3 py-2.5">
      {/* Icon disk + connector line */}
      <div className="relative flex flex-col items-center">
        <motion.div
          initial={false}
          animate={
            status === "active"
              ? { scale: [1, 1.08, 1], boxShadow: [
                  "0 0 0 0 rgba(252,211,77,0.45)",
                  "0 0 0 8px rgba(252,211,77,0)",
                  "0 0 0 0 rgba(252,211,77,0)",
                ] }
              : { scale: 1 }
          }
          transition={{ duration: 1.6, repeat: status === "active" ? Infinity : 0 }}
          className="flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: colors.iconBg, color: colors.iconFg }}
        >
          <div className="h-5 w-5">{step.icon}</div>
        </motion.div>
        {!isLast ? (
          <div
            className="mt-1 w-[3px] flex-1 rounded-full"
            style={{ background: colors.connector, minHeight: "20px" }}
          />
        ) : null}
      </div>

      {/* Label + detail */}
      <div className="flex-1 pb-2 pt-1">
        <div
          className="font-semibold leading-tight"
          style={{
            color: colors.label,
            fontFamily:
              'var(--font-bebas), "Bebas Neue", system-ui, sans-serif',
            fontSize: "18px",
            letterSpacing: "0.04em",
          }}
        >
          {step.label}
        </div>
        <div className="mt-0.5 text-xs" style={{ color: colors.detail }}>
          {step.detail}
        </div>
      </div>
    </li>
  )
}

/**
 * Demo state-machine hook · auto-advances through the 6 steps on
 * a fixed cadence so the user can SEE the experience without a
 * real order in flight. Round 92+ replaces this with a Supabase
 * subscription on the order row.
 */
export function useDemoOrderState(active: boolean): OrderStatus {
  const [status, setStatus] = useState<OrderStatus>("RECIBIDO")
  useEffect(() => {
    if (!active) return
    setStatus("RECIBIDO")
    const timers: number[] = []
    const schedule: { at: number; status: OrderStatus }[] = [
      { at: 2200, status: "ACEPTADO" },
      { at: 5000, status: "COCINANDO" },
      { at: 11000, status: "LISTO" },
      { at: 14500, status: "EN_CAMINO" },
      { at: 22000, status: "ENTREGADO" },
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
