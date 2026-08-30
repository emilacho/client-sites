"use client"
/**
 * OrderTrackerWidget · R97.7 · "El Mapa del Tesoro" v9
 *
 * 7 features iterativas sobre v8 ·
 *   1) Microcopy storytelling náutico rotatorio per stage
 *   2) Canoa rotada siguiendo tangente del Bezier + rocking motion
 *   3) Stage transition celebration · pop overlay con nuevo emoji + label
 *   4) Rider card enriched · avatar inicial + stars + plate + call button
 *   5) Ambient map motion · waves shift · mountain breath · canoa rocking
 *   6) Order summary collapsable · cart_lines compact + expand
 *   7) Timeline timestamps overlay · cada lifecycle event con hora
 */
import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronDown, ChevronUp, Phone, Clock } from "lucide-react"

const LS_KEY = "naufrago_active_order_code"
const POLL_MS = 3_000
const MICROCOPY_ROTATE_MS = 9_000

interface CartLine {
  id: string
  name: string
  priceUsd: number
  qty: number
}

interface TrackerSnapshot {
  ok: boolean
  order_code: string
  status: string
  delivery_substatus: string | null
  stage: string
  stage_index: number
  canoa_pct: number
  delivery_eta_minutes: number | null
  cart_lines: CartLine[]
  subtotal_usd: number
  total_usd: number
  created_at: string | null
  accepted_at: string | null
  preparing_at: string | null
  ready_at: string | null
  rider_picked_up_at: string | null
  in_transit_at: string | null
  delivered_at: string | null
  rider_info: {
    name?: string
    plate?: string
    phone?: string
    vehicleType?: string
    rating?: number
    tenure_months?: number
    distance_remaining_m?: number
    total_distance_m?: number
    eta_min?: number
  } | null
  payment_method?: string | null
}

// ── Tokens canon Náufrago ───────────────────────────────────────────
const PURPLE = "#3D2466"
const PURPLE_DARK = "#1F1138"
const CYAN = "#4DD4D8"
const CYAN_DARK = "#2BA8AC"
const SAND = "#F5E9D2"
const SAND_DARK = "#E8D9B5"
const PARCHMENT = "#F0E2BB"
const INK = "#3D2466"
const RED_PIRATE = "#D92235"

// ── Stages canon · 4 etapas pattern Domino's adaptado ──────────────
// R97.7.2 · labels descriptivos (era 1 palabra · ahora frase completa)
const STAGES = [
  { idx: 1, key: "received", label: "Pedido recibido", emoji: "⚓" },
  { idx: 2, key: "preparing", label: "Preparando tu pedido", emoji: "🍳" },
  { idx: 3, key: "en_route", label: "Zarpando a tu destino", emoji: "🛶" },
  { idx: 4, key: "delivered", label: "¡Llegó!", emoji: "🌊" },
] as const

// ── Microcopy storytelling · 3-4 frases por stage · pick random ────
const STAGE_COPY: Record<string, string[]> = {
  received: [
    "Los cocineros recibieron tu carta",
    "Náufrago en la cocina · armando provisiones",
    "Tu pedido subió a bordo",
    "La cocina aceptó tu encomienda",
  ],
  preparing: [
    "Marco está cocinando con cariño 🍳",
    "El pescado se sella en la sartén",
    "La vela se infla · cargamos provisiones",
    "Aroma a mar · tu plato está naciendo",
  ],
  en_route: [
    "Vela inflada · vamos a 5 nudos",
    "Marco rema firme hacia tu isla",
    "Cruzando el río · rumbo a tu costa",
    "Brisa a favor · la canoa avanza",
  ],
  delivered: [
    "¡Llegó tu tesoro · náufrago!",
    "Disfrutalo bien caliente 🌊",
    "Buen provecho · marinero",
    "Hasta tu próxima travesía",
  ],
}

// ── Geometría del mapa SVG ─────────────────────────────────────────
const MAP_W = 380
const MAP_H = 220
const PICKUP_X = 50
const PICKUP_Y = 60
const DROPOFF_X = 330
const DROPOFF_Y = 170
const CTRL_X = 200
const CTRL_Y = 40

/** Quadratic Bezier point at t ∈ [0,1] */
function bezierAt(t: number) {
  const u = 1 - t
  const x = u * u * PICKUP_X + 2 * u * t * CTRL_X + t * t * DROPOFF_X
  const y = u * u * PICKUP_Y + 2 * u * t * CTRL_Y + t * t * DROPOFF_Y
  return { x, y }
}

/** Bezier tangent at t · derivative · for canoa rotation */
function bezierTangent(t: number) {
  const dx = 2 * (1 - t) * (CTRL_X - PICKUP_X) + 2 * t * (DROPOFF_X - CTRL_X)
  const dy = 2 * (1 - t) * (CTRL_Y - PICKUP_Y) + 2 * t * (DROPOFF_Y - CTRL_Y)
  return Math.atan2(dy, dx) * (180 / Math.PI)
}

function formatTime(ts: string | null): string {
  if (!ts) return "—"
  try {
    return new Date(ts).toLocaleTimeString("es-EC", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
  } catch {
    return "—"
  }
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function OrderTrackerWidget() {
  const [code, setCode] = useState<string | null>(null)
  const [snap, setSnap] = useState<TrackerSnapshot | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [driverOpen, setDriverOpen] = useState(false)
  const [orderOpen, setOrderOpen] = useState(false)
  const [timelineOpen, setTimelineOpen] = useState(false)
  const [autoDismissTimer, setAutoDismissTimer] = useState<number | null>(null)

  // ── Stage transition celebration ─────────────────────────────────
  const prevStageRef = useRef<string | null>(null)
  const [celebrating, setCelebrating] = useState<{
    emoji: string
    label: string
    copy: string
  } | null>(null)

  // ── Microcopy rotator ────────────────────────────────────────────
  const [microcopy, setMicrocopy] = useState<string>("")

  // ── Ambient motion · single rAF loop ─────────────────────────────
  const [now, setNow] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = () => {
      setNow((performance.now() - start) / 1000)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // ── Sync code from localStorage + event ──────────────────────────
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
        // ignore
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
            }, 45_000)
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

  // ── Stage transition detection · trigger celebration ─────────────
  // R97.7.1 · fix · usar useRef para timer · evita race condition donde
  // el cleanup del effect cancela el setTimeout antes de que dispare ·
  // sin esto el celebrating overlay quedaba pegado tras un stage change.
  const celebrationTimerRef = useRef<number | null>(null)
  useEffect(() => {
    if (!snap) return
    const currStage = snap.stage
    const prevStage = prevStageRef.current
    if (prevStage && prevStage !== currStage) {
      const stageDef = STAGES.find((s) => s.key === currStage)
      if (stageDef) {
        const copyArr = STAGE_COPY[currStage] ?? []
        setCelebrating({
          emoji: stageDef.emoji,
          label: stageDef.label,
          copy: pickRandom(copyArr) ?? "",
        })
        // Cancelar timer anterior (si había celebration previo aún activo)
        if (celebrationTimerRef.current !== null) {
          window.clearTimeout(celebrationTimerRef.current)
        }
        // Schedule clear · NO cancelar via effect cleanup
        celebrationTimerRef.current = window.setTimeout(() => {
          setCelebrating(null)
          celebrationTimerRef.current = null
        }, 2200)
      }
    }
    prevStageRef.current = currStage
  }, [snap])

  // Cleanup celebration timer ONLY on unmount
  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current !== null) {
        window.clearTimeout(celebrationTimerRef.current)
      }
    }
  }, [])

  // ── Microcopy rotator · pick new on stage change + every 9s ──────
  useEffect(() => {
    if (!snap) return
    const arr = STAGE_COPY[snap.stage] ?? []
    if (arr.length === 0) {
      setMicrocopy("")
      return
    }
    setMicrocopy(pickRandom(arr))
    const id = window.setInterval(() => {
      setMicrocopy(pickRandom(arr))
    }, MICROCOPY_ROTATE_MS)
    return () => window.clearInterval(id)
  }, [snap?.stage])

  if (!code || dismissed) return null

  const activeIdx = snap?.stage_index ?? 1
  const currentStage =
    STAGES.find((s) => s.idx === activeIdx) ?? STAGES[0]
  // R97.7.4 · sub-status text conditional según payment_method ·
  // cash flows reciben "prepará el efectivo" · card/digital recibe "está
  // por llegar". Para AT_DESTINATION mensaje es igual (cliente sale igual).
  const isCashPayment =
    snap?.payment_method === "CASH_ON_DELIVERY" ||
    snap?.payment_method === "WHATSAPP_MANUAL"
  const subStatusBadge =
    snap?.delivery_substatus === "NEARING_DESTINATION"
      ? {
          emoji: "📍",
          text: isCashPayment
            ? "Cerca · prepará el efectivo"
            : "Cerca · está por llegar",
          tone: "cyan" as const,
        }
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
  const canoaAngle = bezierTangent(canoaT)
  // Rocking motion · ±3° sine wave
  const canoaRock = Math.sin(now * 1.8) * 3
  // Wave shift · subtle horizontal motion 0-4px over 8s loop
  const waveShift = Math.sin(now * 0.4) * 2
  // Mountain breath · scale 1.0 → 1.025 over 4s loop
  // El latido suave de la cocina · antes se llamaba "mtnBreath"
  // (respiración de la montaña) cuando ahí había una montaña suiza.
  const latidoCocina = 1 + (Math.sin(now * 0.5) + 1) * 0.012

  const isNearing = snap?.delivery_substatus === "NEARING_DESTINATION"
  const isAt = snap?.delivery_substatus === "AT_DESTINATION"
  const isDelivered = snap?.stage === "delivered"
  const showCanoa = snap?.stage === "en_route" || isDelivered || isNearing || isAt

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

  const rider = snap?.rider_info
  const riderInitial = rider?.name?.charAt(0).toUpperCase() ?? "?"
  const riderStars = Math.round(rider?.rating ?? 0)

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
        className="pointer-events-auto fixed bottom-4 right-4 z-[55] w-[min(480px,calc(100vw-2rem))] overflow-hidden rounded-3xl shadow-2xl"
        style={{
          background: SAND,
          border: `3px solid ${PURPLE}`,
          boxShadow:
            "0 24px 48px -16px rgba(31,17,56,0.55), 0 0 0 1px rgba(255,255,255,0.4) inset",
        }}
        role="region"
        aria-label="Tracker de pedido Náufrago"
      >
        {/* ═══════ HEADER · stages dots + microcopy ═══════ */}
        <div
          className="relative px-5 pt-3 pb-4"
          style={{
            background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DARK} 100%)`,
            color: "#FFFFFF",
          }}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-75">
                ✦ Pedido NF-{code.slice(-6)}
              </span>
              <button
                type="button"
                onClick={() => setTimelineOpen((v) => !v)}
                aria-label="Ver historial de tiempos"
                className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide transition-colors hover:bg-white/15"
                style={{
                  background: "rgba(255,255,255,0.10)",
                  color: CYAN,
                  border: "1px solid rgba(77,212,216,0.35)",
                }}
              >
                <Clock className="h-3.5 w-3.5" />
                <span>Historial</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Cerrar tracker"
              className="rounded-full p-1.5 transition-colors hover:bg-white/15"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 4 stages dots */}
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
                      className="relative flex h-9 w-9 items-center justify-center rounded-full text-lg transition-all duration-500"
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
                          style={{ background: CYAN, opacity: 0.35 }}
                        />
                      ) : null}
                    </div>
                    <span
                      className={[
                        "text-center text-[9px] font-semibold leading-[1.15] tracking-tight",
                        isActive ? "" : isPast ? "opacity-80" : "opacity-50",
                      ].join(" ")}
                      style={{
                        color: isActive ? CYAN : "#FFFFFF",
                        textWrap: "balance",
                        maxWidth: "85px",
                      }}
                    >
                      {stage.label}
                    </span>
                  </div>
                  {i < STAGES.length - 1 ? (
                    <div
                      className="h-0.5 flex-1 transition-colors duration-500"
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

          {/* Microcopy storytelling · rotates every 9s · per stage */}
          <AnimatePresence mode="wait">
            {microcopy ? (
              <motion.p
                key={microcopy}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.4 }}
                className="mt-3 text-center font-[family-name:var(--font-handwritten),cursive] text-base italic opacity-90"
              >
                &ldquo;{microcopy}&rdquo;
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>

        {/* ═══════ MAP SECTION · pergamino ═══════ */}
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
              aria-label="Mapa del recorrido"
            >
              <defs>
                <pattern id="grain" width="20" height="20" patternUnits="userSpaceOnUse">
                  <circle cx="10" cy="10" r="0.6" fill="rgba(61,36,102,0.07)" />
                </pattern>
                <linearGradient id="routeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={CYAN} stopOpacity="0.8" />
                  <stop offset="100%" stopColor={PURPLE} stopOpacity="0.8" />
                </linearGradient>
                <filter id="canoaShadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="2" stdDeviation="1.5" floodColor="#3D2466" floodOpacity="0.35" />
                </filter>
              </defs>
              <rect width={MAP_W} height={MAP_H} fill="url(#grain)" />

              {/* Wavy sea decorative lines · ambient shift */}
              {[45, 90, 135, 180].map((y, idx) => (
                <path
                  key={`wave-${y}`}
                  d={`M ${-10 + waveShift * (idx % 2 === 0 ? 1 : -1)} ${y} Q 30 ${y - 3}, 60 ${y} T 120 ${y} T 180 ${y} T 240 ${y} T 300 ${y} T 380 ${y} T 440 ${y}`}
                  stroke="rgba(61,36,102,0.10)"
                  strokeWidth="0.8"
                  fill="none"
                />
              ))}

              {/* Route · dashed curve */}
              <path
                d={`M ${PICKUP_X} ${PICKUP_Y} Q ${CTRL_X} ${CTRL_Y}, ${DROPOFF_X} ${DROPOFF_Y}`}
                stroke="url(#routeGrad)"
                strokeWidth="2.5"
                strokeDasharray="6 4"
                fill="none"
                strokeLinecap="round"
              />

              {/* R142 · DE DÓNDE SALE EL PEDIDO · acá decía "TÄSCH" con un
                  emoji de montaña. Täsch es un pueblo de los Alpes suizos:
                  quedó del cliente de prueba con el que se armó el mapa
                  (los pedidos de mayo iban a Zermatt). O sea que el cliente
                  de Guayaquil veía su encebollado saliendo de una montaña
                  en Suiza. Ahora dice lo que es: la cocina, con la olla que
                  ya usa el botón de combos. */}
              <g>
                <g style={{
                  transform: `scale(${latidoCocina})`,
                  transformOrigin: `${PICKUP_X}px ${PICKUP_Y}px`,
                  transition: "transform 0.2s linear",
                }}>
                  <circle cx={PICKUP_X} cy={PICKUP_Y} r="16" fill={SAND} stroke={PURPLE} strokeWidth="2" />
                  <text x={PICKUP_X} y={PICKUP_Y + 7} textAnchor="middle" fontSize="22">🍲</text>
                </g>
                {/* Dos renglones · "COCINA NÁUFRAGO" en una sola línea se
                    sale por la izquierda del dibujo (el punto está en x=50). */}
                <text x={PICKUP_X} y={PICKUP_Y + 33} textAnchor="middle" fontSize="10" fontWeight="700" fill={PURPLE} fontFamily="ui-monospace, Menlo, monospace">
                  COCINA
                </text>
                <text x={PICKUP_X} y={PICKUP_Y + 44} textAnchor="middle" fontSize="10" fontWeight="700" fill={PURPLE} fontFamily="ui-monospace, Menlo, monospace">
                  NÁUFRAGO
                </text>
              </g>

              {/* Dropoff · isla · X marks the spot */}
              <g>
                {/* Pulse ring · cuando NEARING o AT */}
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
                    <animate attributeName="r" from="14" to="32" dur="1.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" from="0.6" to="0" dur="1.4s" repeatCount="indefinite" />
                  </circle>
                ) : null}
                <circle
                  cx={DROPOFF_X}
                  cy={DROPOFF_Y}
                  r="16"
                  fill={isDelivered ? CYAN : SAND}
                  stroke={isAt || isDelivered ? PURPLE : "rgba(61,36,102,0.7)"}
                  strokeWidth="2"
                />
                <text x={DROPOFF_X} y={DROPOFF_Y + 7} textAnchor="middle" fontSize="22">🏝</text>
                {/* X marks the spot · pirate map */}
                <text
                  x={DROPOFF_X + 22}
                  y={DROPOFF_Y - 10}
                  textAnchor="middle"
                  fontSize="16"
                  fontWeight="900"
                  fill={RED_PIRATE}
                  transform={`rotate(20 ${DROPOFF_X + 22} ${DROPOFF_Y - 10})`}
                >
                  ✕
                </text>
                <text x={DROPOFF_X} y={DROPOFF_Y + 34} textAnchor="middle" fontSize="10" fontWeight="700" fill={PURPLE} fontFamily="ui-monospace, Menlo, monospace">
                  TU ISLA
                </text>
              </g>

              {/* Canoa · R97.7.4 refactor · 2 SVG groups anidados ·
                  outer maneja position translate (slow transition 700ms
                  per poll tick) · inner maneja rocking rotation (sin
                  transition · continuous via rAF · NO bloquea el outer
                  transition que es lo que da la sensación de avance) */}
              {showCanoa ? (
                <g
                  style={{
                    transform: `translate(${canoaPos.x - MAP_W / 2}px, ${canoaPos.y - MAP_H / 2}px)`,
                    transformOrigin: `${MAP_W / 2}px ${MAP_H / 2}px`,
                    transition: "transform 700ms cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                >
                  {/* Wake · solo durante en_route · sin rocking, rota
                      con el tangente solo (apunta opuesto a la canoa) */}
                  {snap?.stage === "en_route" ? (
                    <g
                      opacity="0.4"
                      style={{
                        transform: `rotate(${canoaAngle}deg)`,
                        transformOrigin: `${MAP_W / 2}px ${MAP_H / 2}px`,
                      }}
                    >
                      {[8, 16, 24].map((d, i) => (
                        <circle
                          key={i}
                          cx={MAP_W / 2 - d}
                          cy={MAP_H / 2 + 5}
                          r={1.5 - i * 0.3}
                          fill={CYAN}
                        />
                      ))}
                    </g>
                  ) : null}
                  {/* Canoa rotada + rocking ambient · grupo inner sin
                      transition · el rocking actualiza continuamente
                      sin romper el outer transition de posición */}
                  <g
                    style={{
                      transform: `rotate(${canoaAngle + canoaRock}deg)`,
                      transformOrigin: `${MAP_W / 2}px ${MAP_H / 2}px`,
                    }}
                    filter="url(#canoaShadow)"
                  >
                    <text
                      x={MAP_W / 2}
                      y={MAP_H / 2 + 10}
                      textAnchor="middle"
                      fontSize="30"
                    >
                      🛶
                    </text>
                  </g>
                </g>
              ) : null}

              {/* Delivered · confetti burst */}
              {isDelivered ? (
                <g>
                  {["✨", "🎉", "🌊", "✨", "🎊"].map((emoji, i) => (
                    <text
                      key={`confetti-${i}`}
                      x={DROPOFF_X + (i - 2) * 14}
                      y={DROPOFF_Y - 30 - (i % 3) * 8}
                      textAnchor="middle"
                      fontSize="18"
                    >
                      <animate
                        attributeName="opacity"
                        values="0;1;1;0"
                        dur="2.4s"
                        begin={`${i * 0.25}s`}
                        repeatCount="indefinite"
                      />
                      <animateTransform
                        attributeName="transform"
                        type="translate"
                        values="0,0; 0,-15; 0,0"
                        dur="2.4s"
                        begin={`${i * 0.25}s`}
                        repeatCount="indefinite"
                      />
                      {emoji}
                    </text>
                  ))}
                </g>
              ) : null}
            </svg>

            {/* Stage transition celebration overlay */}
            <AnimatePresence>
              {celebrating ? (
                <motion.div
                  key={celebrating.label}
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.3 }}
                  transition={{ duration: 0.4, ease: [0.2, 1.4, 0.2, 1] }}
                  className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"
                  style={{
                    background: "rgba(245,233,210,0.92)",
                    backdropFilter: "blur(2px)",
                  }}
                >
                  <span className="text-6xl drop-shadow-md">{celebrating.emoji}</span>
                  <span
                    className="mt-1 font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wider"
                    style={{ color: PURPLE }}
                  >
                    {celebrating.label}
                  </span>
                  <span
                    className="mt-1 font-[family-name:var(--font-handwritten),cursive] text-sm italic"
                    style={{ color: PURPLE_DARK }}
                  >
                    {celebrating.copy}
                  </span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* ═══════ INFO SECTION · ETA · badges · cards ═══════ */}
        <div className="space-y-2.5 px-5 pb-4 pt-2" style={{ color: INK }}>
          {/* ETA */}
          {snap ? (
            <div className="flex items-baseline justify-between gap-2">
              {/* R142 · el pedido ENTREGADO mostraba igual la cuenta
                  regresiva. El pedido real de anoche llegó y el mapa
                  seguía diciendo "44 min" en letra gigante, porque el
                  tiempo estimado que dejó el repartidor sigue guardado y
                  esta rama se preguntaba primero por él. Se pregunta
                  primero si ya llegó · un pedido entregado no tiene
                  cuenta regresiva. */}
              {isDelivered ? (
                <span className="font-[family-name:var(--font-bebas),sans-serif] text-2xl font-bold leading-none">
                  ¡Buen provecho! 🌊
                </span>
              ) : etaMin !== null && etaMin >= 0 ? (
                <div>
                  <span className="font-[family-name:var(--font-bebas),sans-serif] text-3xl font-bold leading-none tracking-wider">
                    {etaMin === 0 ? "Llegando" : `${etaMin}`}
                  </span>
                  {etaMin > 0 ? (
                    <span className="ml-1 text-sm font-medium opacity-70">min</span>
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

          {/* Rider card enriched */}
          {rider?.name ? (
            <div
              className="rounded-xl border px-3 py-2.5"
              style={{
                borderColor: "rgba(61,36,102,0.20)",
                background: "rgba(61,36,102,0.04)",
              }}
            >
              <button
                type="button"
                onClick={() => setDriverOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
                style={{ color: INK }}
              >
                <div className="flex items-center gap-2.5">
                  {/* Avatar · inicial */}
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${PURPLE}, ${CYAN_DARK})` }}
                  >
                    {riderInitial}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold">{rider.name}</span>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {rider.rating ? (
                        <span>
                          {"★".repeat(riderStars)}<span className="opacity-40">{"★".repeat(5 - riderStars)}</span>
                          <span className="ml-1 opacity-70">{rider.rating.toFixed(1)}</span>
                        </span>
                      ) : null}
                      {rider.plate ? (
                        <span className="font-mono opacity-60">· {rider.plate}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{
                    transform: driverOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
              <AnimatePresence>
                {driverOpen ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-2 flex items-center gap-2 border-t pt-2 text-[11px]" style={{ borderColor: "rgba(61,36,102,0.15)" }}>
                      {rider.vehicleType ? (
                        <span className="opacity-70">
                          {rider.vehicleType === "MOTORCYCLE" ? "🛵 Moto" : "🚴 Bici"}
                        </span>
                      ) : null}
                      {rider.tenure_months ? (
                        <span className="opacity-70">· {rider.tenure_months} meses con nosotros</span>
                      ) : null}
                      {rider.phone ? (
                        <a
                          href={`https://wa.me/${rider.phone.replace(/\D/g, "")}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                          style={{ background: `linear-gradient(90deg, ${CYAN_DARK}, ${PURPLE})` }}
                        >
                          <Phone className="h-3 w-3" />
                          Llamar
                        </a>
                      ) : null}
                    </div>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}

          {/* Order summary collapsable */}
          {snap?.cart_lines && snap.cart_lines.length > 0 ? (
            <div
              className="rounded-xl border px-3 py-2"
              style={{
                borderColor: "rgba(61,36,102,0.20)",
                background: "rgba(245,233,210,0.5)",
              }}
            >
              <button
                type="button"
                onClick={() => setOrderOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
                style={{ color: INK }}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-base">🍲</span>
                  <span className="truncate text-[12px] font-semibold">
                    {snap.cart_lines.length} {snap.cart_lines.length === 1 ? "plato" : "platos"} · ${snap.total_usd.toFixed(2)}
                  </span>
                </div>
                {orderOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              <AnimatePresence>
                {orderOpen ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <ul className="mt-2 space-y-1 border-t pt-2 text-[11px]" style={{ borderColor: "rgba(61,36,102,0.15)" }}>
                      {snap.cart_lines.map((line, i) => (
                        <li key={i} className="flex justify-between gap-2">
                          <span className="truncate">
                            <span className="font-mono opacity-60">{line.qty}×</span> {line.name}
                          </span>
                          <span className="tabular-nums opacity-80">
                            ${(line.priceUsd * line.qty).toFixed(2)}
                          </span>
                        </li>
                      ))}
                      <li className="mt-1 flex justify-between border-t pt-1 font-semibold" style={{ borderColor: "rgba(61,36,102,0.15)" }}>
                        <span>Total</span>
                        <span className="tabular-nums">${snap.total_usd.toFixed(2)}</span>
                      </li>
                    </ul>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          ) : null}
        </div>

        {/* Timeline overlay · click clock icon en header abre/cierra */}
        <AnimatePresence>
          {timelineOpen && snap ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 z-10 flex items-end justify-center p-3"
              style={{ background: "rgba(31,17,56,0.65)", backdropFilter: "blur(4px)" }}
              onClick={() => setTimelineOpen(false)}
            >
              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
                transition={{ duration: 0.3 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full rounded-2xl border-2 p-4"
                style={{ background: SAND, borderColor: PURPLE, color: INK }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wider">
                    HISTORIAL
                  </span>
                  <button
                    type="button"
                    onClick={() => setTimelineOpen(false)}
                    className="rounded-full p-1 opacity-70 hover:opacity-100"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <ul className="space-y-1.5 text-[12px]">
                  {[
                    { label: "Pedido recibido", ts: snap.created_at, emoji: "📝" },
                    { label: "Cocina aceptó", ts: snap.accepted_at, emoji: "✅" },
                    { label: "En la cocina", ts: snap.preparing_at, emoji: "🍳" },
                    { label: "Listo para enviar", ts: snap.ready_at, emoji: "📦" },
                    { label: "Motorizado salió", ts: snap.rider_picked_up_at ?? snap.in_transit_at, emoji: "🛵" },
                    { label: "Entregado", ts: snap.delivered_at, emoji: "🌊" },
                  ].map((step, i) => (
                    <li
                      key={i}
                      className={[
                        "flex items-center justify-between gap-2",
                        step.ts ? "opacity-100" : "opacity-30",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2">
                        <span>{step.emoji}</span>
                        <span>{step.label}</span>
                      </div>
                      <span className="font-mono text-[11px] opacity-70">
                        {formatTime(step.ts)}
                      </span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
