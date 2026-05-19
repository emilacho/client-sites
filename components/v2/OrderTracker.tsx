"use client"
/**
 * OrderTracker · Round 92.
 *
 * R91 shipped a Domino's-style bottom-sheet panel · user feedback
 * was that the panel didn't fit the landing's visual language and
 * asked for a duplicated canoe sailing across the ocean to a
 * house, with the status overlay rendered WITHOUT a background so
 * the ocean reads through.
 *
 * R92 retires the panel · keeps the OrderStatus enum + demo state
 * machine. The 3D canoe + house live in Scene.tsx
 * (`OrderJourneyTracker`). This file exports:
 *  - OrderStatus enum
 *  - statusToProgress · maps 6 states to a 0..1 lerp position
 *  - useDemoOrderState · auto-advances the demo cadence
 *  - OrderStatusOverlay · background-less HTML overlay showing
 *    the current step + ETA over the 3D scene
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

export const NAUFRAGO_ORDER_STATUSES: OrderStatus[] = [
  "RECIBIDO",
  "ACEPTADO",
  "COCINANDO",
  "LISTO",
  "EN_CAMINO",
  "ENTREGADO",
]

/**
 * Map a status to a 0..1 progress for the in-scene canoe lerp.
 *   RECIBIDO  · 0.00 · canoe at island dock
 *   ACEPTADO  · 0.05 · canoe loaded
 *   COCINANDO · 0.18 · canoe casting off
 *   LISTO     · 0.42 · canoe mid-water
 *   EN_CAMINO · 0.78 · canoe near the house
 *   ENTREGADO · 1.00 · canoe arrived
 * Non-linear so the visual story emphasizes the journey · the
 * cook stages cluster near the start, the in-flight stage
 * dominates the middle.
 */
export function statusToProgress(status: OrderStatus): number {
  switch (status) {
    case "RECIBIDO":
      return 0
    case "ACEPTADO":
      return 0.05
    case "COCINANDO":
      return 0.18
    case "LISTO":
      return 0.42
    case "EN_CAMINO":
      return 0.78
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
}

export function OrderStatusOverlay({
  open,
  onClose,
  currentStatus,
  orderCode,
  etaMinutes,
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
            // Background-less per user · the ocean reads through.
            // Heavy drop-shadow + thin text-stroke keep readability.
            textShadow:
              "0 2px 12px rgba(0,0,0,0.85), 0 1px 4px rgba(0,0,0,0.95)",
          }}
        >
          {/* Top tiny label · order code + ETA */}
          <div
            className="font-mono uppercase tracking-[0.28em]"
            style={{ color: "#4DD4D8", fontSize: "11px" }}
          >
            {orderCode ?? "NF · pedido"}{" "}
            {!isComplete && etaMinutes ? (
              <span style={{ color: "#FACC15" }}>· ~{etaMinutes} min</span>
            ) : null}
          </div>

          {/* Big status · emoji + label */}
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
                filter:
                  "drop-shadow(0 4px 16px rgba(0,0,0,0.8))",
              }}
            >
              {copy.emoji}
            </motion.span>
            <motion.span
              key={`${copy.id}-label`}
              initial={{ x: -8, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{
                color: isComplete ? "#FACC15" : "#4DD4D8",
                fontSize: "42px",
                lineHeight: 1,
              }}
            >
              {copy.label}
            </motion.span>
          </div>

          {/* Detail line · smaller, sepia for contrast */}
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
    const schedule: { at: number; status: OrderStatus }[] = [
      { at: 2200, status: "ACEPTADO" },
      { at: 5500, status: "COCINANDO" },
      { at: 11000, status: "LISTO" },
      { at: 15000, status: "EN_CAMINO" },
      { at: 24000, status: "ENTREGADO" },
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
