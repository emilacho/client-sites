"use client"
/**
 * OrderTrackerWidget · R97.6 · "El Mapa del Tesoro"
 *
 * Rediseño completo · combina pattern Domino's Pizza Tracker (4 stages
 * dots + iconic moving icon) con tema Náufrago (canoa navegando un
 * pergamino · mapa stylized parchment).
 *
 * Estructura ·
 *  - Header purple gradient · order code + 4 stage dots progress
 *  - Body parchment sand bg · mini-mapa SVG con canoa GPS-driven
 *  - Footer · ETA grande + sub-status badge + driver card collapsable
 *
 * GPS data flow · canoa_pct viene del API · computado desde rider_info
 * .distance_remaining_m / total_distance_m · API recibe estos campos
 * del simulator (mock mode) o del webhook PedidosYa (real mode). El
 * widget solo es presentation · 100% reactive a esos datos.
 */
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronDown } from "lucide-react"

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
    plate?: string
    phone?: string
    vehicleType?: string
    distance_remaining_m?: number
    total_distance_m?: number
    eta_min?: number
  } | null
}

// ── Tokens visuales canon Náufrago ──────────────────────────────────
const PURPLE = "#3D2466"
const PURPLE_DARK = "#1F1138"
const CYAN = "#4DD4D8"
const CYAN_DARK = "#2BA8AC"
const SAND = "#F5E9D2"
const SAND_DARK = "#E8D9B5"
const PARCHMENT = "#F0E2BB"
const INK = "#3D2466"

// 4 stages canon · pattern Domino's adaptado con identidad Náufrago.
// stage_index del API · 1=received · 2=preparing · 3=en_route · 4=delivered
const STAGES = [
  { idx: 1, key: "received", label: "Anclado", emoji: "⚓" },
  { idx: 2, key: "preparing", label: "Zarpando", emoji: "🍳" },
  { idx: 3, key: "en_route", label: "Navegando", emoji: "🛶" },
  { idx: 4, key: "delivered", label: "¡Llegó!", emoji: "🌊" },
] as const

// ── SVG map geometry ──────────────────────────────────────────────
// Pickup (Täsch) en esquina sup-izq · Dropoff (cliente) en esquina inf-der
// Curva quadratic Bezier · control point arriba-centro · ruta arqueada
const MAP_W = 380
const MAP_H = 200
const PICKUP_X = 50
const PICKUP_Y = 50
const DROPOFF_X = 330
const DROPOFF_Y = 155
const CTRL_X = 200
const CTRL_Y = 30

/** Quadratic Bezier point at t ∈ [0,1] · B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2 */
function bezierAt(t: number) {
  const u = 1 - t
  const x = u * u * PICKUP_X + 2 * u * t * CTRL_X + t * t * DROPOFF_X
  const y = u * u * PICKUP_Y + 2 * u * t * CTRL_Y + t * t * DROPOFF_Y
  return { x, y }
}

export function OrderTrackerWidget() {
  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<TrackerSnapshot | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [driverOpen, setDriverOpen] = useState(false)
  const [autoDismissTimer, setAutoDismissTimer] = useState<number | null>(null)

  // ── Mount · read active order from localStorage + listen events ─
  useEffect(() => {
    function syncCode() {
      try {
        const stored = window.localStorage.getItem(LS_KEY)
        if (stored && stored !== code) {
          setCode(stored)
          setDismissed(false)
          setSnap(null)
        } else if (!stored && code) {
          setCode(null)
        }
      } catch {
        // ignore quota
      }
    }
    syncCode()
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ orderCode?: string }>
      const fromDetail = ce.detail?.orderCode
      if (fromDetail && fromDetail !== code) {
        setCode(fromDetail)
        setDismissed(false)
        setSnap(null)
        return
      }
      syncCode()
    }
    window.addEventListener("naufrago:order-active", handler)
    window.addEventListener("storage", handler)
    return () => {
      window.removeEventListener("naufrago:order-active", handler)
      window.removeEventListener("storage", handler)
    }
  }, [code])

  // ── Polling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!code || dismissed) return
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(code!)}`, {
          cache: "no-store",
        })
        if (!res.ok) return
        const data = (await res.json()) as TrackerSnapshot
        if (cancelled) return
        setSnap(data)
        if (data.status === "DELIVERED" || data.status === "CANCELLED") {
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
        // network blip
      }
    }
    void tick()
    const id = window.setInterval(tick, POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [code, dismissed, autoDismissTimer])

  if (!code || dismissed) return null

  const activeIdx = snap?.stage_index ?? 1
  const currentStage =
    STAGES.find((s) => s.idx === activeIdx) ?? STAGES[0]
  const subStatusBadge =
    snap?.delivery_substatus === "NEARING_DESTINATION"
      ? { emoji: "📍", text: "Cerca · prepará el efectivo", tone: "cyan" as const }
      : snap?.delivery_substatus === "AT_DESTINATION"
        ? { emoji: "🚪", text: "¡Llegó! Sal a recibir", tone: "purple" as const }
        : null
  const etaMin =
    snap?.rider_info?.eta_min ??
    snap?.delivery_eta_minutes ??
    null
  const distanceM = snap?.rider_info?.distance_remaining_m ?? null
  const canoaPct = Math.max(0, Math.min(100, snap?.canoa_pct ?? 0))
  const canoaT = canoaPct / 100
  const canoaPos = bezierAt(canoaT)

  // Sub-status pulses
  const isNearing = snap?.delivery_substatus === "NEARING_DESTINATION"
  const isAt = snap?.delivery_substatus === "AT_DESTINATION"
  const isDelivered = snap?.stage === "delivered"

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
        initial={{ opacity: 0, y: 80, scale: 0.5 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.9 }}
        transition={{
          duration: 0.55,
          ease: [0.2, 1.4, 0.2, 1],
          scale: { type: "spring", stiffness: 240, damping: 16 },
        }}
        className="pointer-events-auto fixed bottom-4 right-4 z-[55] w-[min(460px,calc(100vw-2rem))] overflow-hidden rounded-3xl shadow-2xl"
        style={{
          background: SAND,
          border: `3px solid ${PURPLE}`,
          boxShadow:
            "0 24px 48px -16px rgba(31,17,56,0.55), 0 0 0 1px rgba(255,255,255,0.4) inset",
        }}
        role="region"
        aria-label="Tracker de pedido Náufrago"
      >
        {/* ─── HEADER · stages dots progress · purple gradient ─── */}
        <div
          className="relative px-5 pt-3 pb-4"
          style={{
            background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DARK} 100%)`,
            color: "#FFFFFF",
          }}
        >
          {/* top row · order code + close */}
          <div className="mb-3 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-75">
              ✦ Pedido NF-{code.slice(-6)}
            </span>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar tracker"
              className="rounded-full p-1.5 transition-colors hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 4 stages dots · pattern Domino's */}
          <div className="flex items-center justify-between gap-1">
            {STAGES.map((stage, i) => {
              const isPast = stage.idx < activeIdx
              const isActive = stage.idx === activeIdx
              const isCurrent = isActive || isPast
              const dotColor = isCurrent ? CYAN : "rgba(255,255,255,0.25)"
              return (
                <div key={stage.key} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center gap-1">
                    <div
                      className="relative flex h-9 w-9 items-center justify-center rounded-full text-lg transition-all"
                      style={{
                        background: dotColor,
                        boxShadow: isActive
                          ? `0 0 0 4px rgba(77,212,216,0.25), 0 0 16px rgba(77,212,216,0.6)`
                          : "none",
                        color: isCurrent ? PURPLE_DARK : "rgba(255,255,255,0.6)",
                      }}
                    >
                      <span aria-hidden>{isPast ? "✓" : stage.emoji}</span>
                      {isActive && !isDelivered ? (
                        <span
                          aria-hidden
                          className="absolute inset-0 rounded-full animate-ping"
                          style={{
                            background: CYAN,
                            opacity: 0.35,
                          }}
                        />
                      ) : null}
                    </div>
                    <span
                      className={[
                        "text-[10px] font-semibold leading-tight",
                        isActive ? "" : isPast ? "opacity-80" : "opacity-50",
                      ].join(" ")}
                      style={{ color: isActive ? CYAN : "#FFFFFF" }}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {i < STAGES.length - 1 ? (
                    <div
                      className="h-0.5 flex-1 transition-colors"
                      style={{
                        background:
                          stage.idx < activeIdx ? CYAN : "rgba(255,255,255,0.18)",
                      }}
                    />
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>

        {/* ─── MAP SECTION · pergamino themed ─── */}
        <div className="relative px-4 pt-4 pb-2">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span
              className="font-[family-name:var(--font-handwritten),cursive] text-base"
              style={{ color: INK }}
            >
              Pergamino · El Mapa del Tesoro
            </span>
            <span
              className="font-mono text-[10px] uppercase tracking-widest"
              style={{ color: "rgba(61,36,102,0.55)" }}
            >
              {currentStage.label}
            </span>
          </div>

          {/* SVG mini-map · 380x200 viewBox */}
          <div
            className="relative overflow-hidden rounded-2xl border-2"
            style={{
              background: `linear-gradient(135deg, ${PARCHMENT} 0%, ${SAND_DARK} 100%)`,
              borderColor: "rgba(61,36,102,0.35)",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -2px 0 rgba(61,36,102,0.10)",
            }}
          >
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="block h-auto w-full"
              role="img"
              aria-label="Mapa del recorrido del motorizado"
            >
              {/* Parchment grain texture (subtle dots) */}
              <defs>
                <pattern
                  id="grain"
                  width="20"
                  height="20"
                  patternUnits="userSpaceOnUse"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="0.6"
                    fill="rgba(61,36,102,0.07)"
                  />
                </pattern>
                <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={CYAN} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={PURPLE} stopOpacity="0.8" />
                </linearGradient>
                {/* Drop shadow for canoa */}
                <filter id="canoaShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#3D2466" floodOpacity="0.35" />
                </filter>
              </defs>
              <rect width={MAP_W} height={MAP_H} fill="url(#grain)" />

              {/* Wavy sea decorative lines (parchment ocean) */}
              {[35, 75, 115, 155].map((y) => (
                <path
                  key={`wave-${y}`}
                  d={`M 0 ${y} Q 30 ${y - 3}, 60 ${y} T 120 ${y} T 180 ${y} T 240 ${y} T 300 ${y} T 380 ${y}`}
                  stroke="rgba(61,36,102,0.08)"
                  strokeWidth="0.8"
                  fill="none"
                />
              ))}

              {/* Route · dashed curve from pickup to dropoff */}
              <path
                d={`M ${PICKUP_X} ${PICKUP_Y} Q ${CTRL_X} ${CTRL_Y}, ${DROPOFF_X} ${DROPOFF_Y}`}
                stroke="url(#routeGrad)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                fill="none"
                strokeLinecap="round"
              />

              {/* Pickup marker · Täsch · mountain emoji + label */}
              <g>
                <circle
                  cx={PICKUP_X}
                  cy={PICKUP_Y}
                  r="14"
                  fill={SAND}
                  stroke={PURPLE}
                  strokeWidth="2"
                />
                <text
                  x={PICKUP_X}
                  y={PICKUP_Y + 7}
                  textAnchor="middle"
                  fontSize="20"
                >
                  🏔
                </text>
                <text
                  x={PICKUP_X}
                  y={PICKUP_Y + 32}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={PURPLE}
                  fontFamily="ui-monospace, Menlo, monospace"
                >
                  TÄSCH
                </text>
              </g>

              {/* Dropoff marker · isla destino · X marks the spot */}
              <g>
                {/* Pulse ring · only when nearing destination */}
                {isNearing || isAt ? (
                  <circle
                    cx={DROPOFF_X}
                    cy={DROPOFF_Y}
                    r="14"
                    fill="none"
                    stroke={isAt ? PURPLE : CYAN}
                    strokeWidth="2"
                    opacity="0.5"
                  >
                    <animate
                      attributeName="r"
                      from="14"
                      to="28"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.6"
                      to="0"
                      dur="1.4s"
                      repeatCount="indefinite"
                    />
                  </circle>
                ) : null}
                <circle
                  cx={DROPOFF_X}
                  cy={DROPOFF_Y}
                  r="14"
                  fill={isDelivered ? CYAN : SAND}
                  stroke={isAt || isDelivered ? PURPLE : "rgba(61,36,102,0.7)"}
                  strokeWidth="2"
                />
                <text
                  x={DROPOFF_X}
                  y={DROPOFF_Y + 7}
                  textAnchor="middle"
                  fontSize="20"
                >
                  🏝
                </text>
                {/* X marks the spot · pirate map convention */}
                <text
                  x={DROPOFF_X + 18}
                  y={DROPOFF_Y - 8}
                  textAnchor="middle"
                  fontSize="14"
                  fontWeight="900"
                  fill="#D92235"
                  transform={`rotate(20 ${DROPOFF_X + 18} ${DROPOFF_Y - 8})`}
                >
                  ✕
                </text>
                <text
                  x={DROPOFF_X}
                  y={DROPOFF_Y + 32}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={PURPLE}
                  fontFamily="ui-monospace, Menlo, monospace"
                >
                  TU ISLA
                </text>
              </g>

              {/* Canoa · only render when en_route or near destination */}
              {(snap?.stage === "en_route" ||
                snap?.stage === "delivered" ||
                isNearing ||
                isAt) ? (
                <g
                  style={{
                    transform: `translate(${canoaPos.x - MAP_W / 2}px, ${canoaPos.y - MAP_H / 2}px)`,
                    transformOrigin: `${MAP_W / 2}px ${MAP_H / 2}px`,
                    transition: "transform 700ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                  filter="url(#canoaShadow)"
                >
                  <text
                    x={MAP_W / 2}
                    y={MAP_H / 2 + 8}
                    textAnchor="middle"
                    fontSize="28"
                  >
                    🛶
                  </text>
                </g>
              ) : null}

              {/* Delivered · confetti emoji burst */}
              {isDelivered ? (
                <g>
                  {["✨", "🎉", "🌊", "✨"].map((emoji, i) => (
                    <text
                      key={`confetti-${i}`}
                      x={DROPOFF_X + (i % 2 === 0 ? -20 : 20)}
                      y={DROPOFF_Y - 25 - i * 10}
                      textAnchor="middle"
                      fontSize="16"
                      opacity={0.85}
                    >
                      <animate
                        attributeName="opacity"
                        values="0;1;0"
                        dur="2s"
                        begin={`${i * 0.3}s`}
                        repeatCount="indefinite"
                      />
                      {emoji}
                    </text>
                  ))}
                </g>
              ) : null}
            </svg>
          </div>
        </div>

        {/* ─── INFO SECTION ─── */}
        <div className="space-y-2.5 px-5 pb-4 pt-3" style={{ color: INK }}>
          {/* ETA row */}
          {snap ? (
            <div className="flex items-baseline justify-between gap-2">
              {etaMin !== null && etaMin >= 0 ? (
                <div>
                  <span className="font-[family-name:var(--font-bebas),sans-serif] text-3xl font-bold leading-none tracking-wider">
                    {etaMin === 0 ? "Llegando" : `${etaMin}`}
                  </span>
                  {etaMin > 0 ? (
                    <span className="ml-1 text-sm font-medium opacity-70">
                      min
                    </span>
                  ) : null}
                  {distanceM !== null ? (
                    <span className="ml-2 text-sm opacity-60">
                      · {(distanceM / 1000).toFixed(1)} km
                    </span>
                  ) : null}
                </div>
              ) : isDelivered ? (
                <span className="font-[family-name:var(--font-bebas),sans-serif] text-2xl font-bold leading-none">
                  ¡Buen provecho! 🌊
                </span>
              ) : (
                <span className="text-sm font-medium opacity-70">
                  Coordinando envío…
                </span>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
                style={{ color: PURPLE }}
              />
              <span className="font-semibold" style={{ color: PURPLE }}>
                Cargando estado…
              </span>
            </div>
          )}

          {/* Sub-status badge · NEARING / AT */}
          {subStatusBadge ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold"
              style={{
                background:
                  subStatusBadge.tone === "purple"
                    ? PURPLE
                    : `linear-gradient(90deg, ${CYAN} 0%, ${CYAN_DARK} 100%)`,
                color: subStatusBadge.tone === "purple" ? "#FFFFFF" : PURPLE_DARK,
              }}
            >
              <span className="text-xl">{subStatusBadge.emoji}</span>
              <span>{subStatusBadge.text}</span>
            </motion.div>
          ) : null}

          {/* Driver card collapsable */}
          {snap?.rider_info?.name ? (
            <button
              type="button"
              onClick={() => setDriverOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition-colors"
              style={{
                borderColor: "rgba(61,36,102,0.20)",
                background: "rgba(61,36,102,0.04)",
                color: INK,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{snap.rider_info.vehicleType === "MOTORCYCLE" ? "🛵" : "🚴"}</span>
                <span className="font-semibold">{snap.rider_info.name}</span>
                {driverOpen && snap.rider_info.plate ? (
                  <span className="font-mono opacity-60">· {snap.rider_info.plate}</span>
                ) : null}
              </div>
              <ChevronDown
                className="h-3.5 w-3.5 transition-transform"
                style={{
                  transform: driverOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              />
            </button>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
