"use client"
/**
 * OrderTrackerWidget · R97.5 · Fase 3 smoke UX fix.
 *
 * Widget flotante bottom-right de la landing · pattern Domino's Pizza
 * Tracker mini · cliente sigue explorando la isla 3D mientras ve el
 * estado de su pedido en tiempo real en una ventanita persistente.
 *
 * Lifecycle ·
 *  - Cliente confirma pedido (CartDrawer success state) · guardamos
 *    el order_code en localStorage `naufrago_active_order_code`
 *  - Widget se monta · lee el code · empieza polling /api/orders/[code]
 *    cada 5s
 *  - Renderiza un card compacto · stage + ETA + canoa mini-progress
 *  - Botón "expandir" → navigate a /order/[code] full screen
 *  - Botón "✕" → cierra el widget + limpia localStorage (pedido sigue
 *    activo · pero el cliente decidió no verlo)
 *  - Al status DELIVERED · widget se queda 30s mostrando "Entregado ✅"
 *    + auto-clear · cliente puede dismiss manual antes
 */
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

const LS_KEY = "naufrago_active_order_code"
const POLL_MS = 5_000

interface TrackerSnapshot {
  ok: boolean
  order_code: string
  status: string
  delivery_substatus: string | null
  stage: string
  stage_index: number
  canoa_pct: number
  delivery_eta_minutes: number | null
  rider_info: {
    name?: string
    distance_remaining_m?: number
    total_distance_m?: number
    eta_min?: number
  } | null
}

const STAGE_LABEL: Record<string, { label: string; emoji: string }> = {
  accepted: { label: "Confirmado", emoji: "✅" },
  preparing: { label: "En cocina", emoji: "🍳" },
  ready: { label: "Listo", emoji: "🛵" },
  en_route: { label: "En camino", emoji: "🛵" },
  delivered: { label: "Entregado", emoji: "🌊" },
  cancelled: { label: "Cancelado", emoji: "✕" },
}

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const SAND = "#F5E9D2"

export function OrderTrackerWidget() {
  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<TrackerSnapshot | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [autoDismissTimer, setAutoDismissTimer] = useState<number | null>(null)

  // Mount · read active order from localStorage + listen to event
  useEffect(() => {
    console.log("[widget] mount · checking localStorage")
    function syncCode() {
      try {
        const stored = window.localStorage.getItem(LS_KEY)
        console.log(`[widget] sync · stored=${stored} code=${code}`)
        if (stored && stored !== code) {
          console.log(`[widget] setCode(${stored})`)
          setCode(stored)
          setDismissed(false)
          setSnap(null)
        } else if (!stored && code) {
          setCode(null)
        }
      } catch (err) {
        console.warn("[widget] sync error", err)
      }
    }
    syncCode()
    const handler = () => {
      console.log("[widget] event received · re-sync")
      syncCode()
    }
    window.addEventListener("naufrago:order-active", handler)
    window.addEventListener("storage", handler)
    return () => {
      window.removeEventListener("naufrago:order-active", handler)
      window.removeEventListener("storage", handler)
    }
  }, [code])

  // Polling de status
  useEffect(() => {
    if (!code || dismissed) return
    console.log(`[widget] polling started code=${code}`)
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(code!)}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          console.warn(`[widget] poll HTTP ${res.status}`)
          return
        }
        const data = (await res.json()) as TrackerSnapshot
        if (cancelled) return
        console.log(`[widget] poll ok · status=${data.status} stage=${data.stage}`)
        setSnap(data)
        if (data.status === "DELIVERED" || data.status === "CANCELLED") {
          // Auto-dismiss en 30s · cliente puede cerrar antes manual
          if (!autoDismissTimer) {
            const id = window.setTimeout(() => {
              try {
                window.localStorage.removeItem(LS_KEY)
              } catch {
                // ignore
              }
              setCode(null)
              setSnap(null)
              setDismissed(false)
            }, 30_000)
            setAutoDismissTimer(id)
          }
        }
      } catch {
        // network blip · siguiente tick reintenta
      }
    }
    void tick()
    const id = window.setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [code, dismissed, autoDismissTimer])

  if (!code || dismissed || !snap) {
    console.log(`[widget] render null · code=${code} dismissed=${dismissed} snap=${!!snap}`)
    return null
  }
  console.log(`[widget] rendering · code=${code} status=${snap.status}`)

  const stageInfo =
    STAGE_LABEL[snap.stage] ?? { label: snap.status, emoji: "📦" }
  const subStatusBadge =
    snap.delivery_substatus === "NEARING_DESTINATION"
      ? { emoji: "📍", text: "Está cerca" }
      : snap.delivery_substatus === "AT_DESTINATION"
        ? { emoji: "🚪", text: "Llegó · sal a recibir" }
        : null
  const etaMin =
    snap.rider_info?.eta_min ??
    snap.delivery_eta_minutes ??
    null

  const handleDismiss = () => {
    try {
      window.localStorage.removeItem(LS_KEY)
    } catch {
      // ignore
    }
    setDismissed(true)
    setCode(null)
    setSnap(null)
  }

  return (
    <AnimatePresence>
      <motion.div
        key={`tracker-widget-${code}`}
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
        className="pointer-events-auto fixed bottom-3 right-3 z-[55] w-[280px] overflow-hidden rounded-2xl shadow-2xl"
        style={{
          background: `linear-gradient(180deg, ${SAND} 0%, #F0E5C9 100%)`,
          border: `2px solid ${PURPLE}`,
          boxShadow: "0 18px 36px -12px rgba(31,17,56,0.55)",
        }}
        role="region"
        aria-label="Tracker de pedido"
      >
        {/* Header · stage + dismiss */}
        <div className="flex items-center justify-between px-3 py-2"
          style={{ background: PURPLE, color: "#FFFFFF" }}>
          <div className="flex items-center gap-2">
            <span className="text-lg" aria-hidden>{stageInfo.emoji}</span>
            <div className="flex flex-col leading-tight">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] opacity-80">
                Pedido {code.slice(-6)}
              </span>
              <span className="text-sm font-semibold">{stageInfo.label}</span>
            </div>
          </div>
          <button
            type="button"
            aria-label="Cerrar widget"
            onClick={handleDismiss}
            className="rounded-full p-1 hover:bg-white/15"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Body · canoa progress + ETA + sub-status banner */}
        <div className="space-y-2 px-3 py-2.5" style={{ color: PURPLE }}>
          {/* Canoa progress bar */}
          {snap.stage === "en_route" || snap.stage === "preparing" || snap.stage === "ready" ? (
            <div className="relative h-2 rounded-full" style={{ background: "rgba(61,36,102,0.15)" }}>
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
                style={{
                  width: `${snap.canoa_pct}%`,
                  background: `linear-gradient(90deg, ${CYAN} 0%, ${PURPLE} 100%)`,
                }}
              />
              <span
                aria-hidden
                className="absolute -top-1.5 text-base transition-all duration-700"
                style={{
                  left: `calc(${snap.canoa_pct}% - 10px)`,
                  filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.3))",
                }}
              >
                🛶
              </span>
            </div>
          ) : null}

          {/* ETA + sub-status badge */}
          <div className="flex items-center justify-between text-[11px]">
            {etaMin !== null && etaMin >= 0 ? (
              <span>
                <strong className="font-semibold">{etaMin === 0 ? "Llegando" : `${etaMin} min`}</strong>
              </span>
            ) : (
              <span className="opacity-60">—</span>
            )}
            {subStatusBadge ? (
              <span
                className="rounded-full px-2 py-0.5 font-semibold"
                style={{
                  background: subStatusBadge.emoji === "🚪" ? PURPLE : CYAN,
                  color: subStatusBadge.emoji === "🚪" ? "#FFFFFF" : PURPLE,
                  fontSize: "10px",
                }}
              >
                {subStatusBadge.emoji} {subStatusBadge.text}
              </span>
            ) : null}
          </div>

          {/* R97.5 v4 · Expand button ELIMINADO · UX feedback Emilio ·
              el botón llevaba a /order/[code] full screen · cliente lo
              tocaba creyendo que era "más info" · perdía la isla · ahora
              el widget ES el tracker · todo se ve aquí · pedido completo
              info ya visible (stage + canoa + ETA + sub-status badges). */}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
