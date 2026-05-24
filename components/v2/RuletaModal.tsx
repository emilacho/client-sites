"use client"

/**
 * RuletaModal · R96.99 · rediseño visual · timón de barco en pergamino
 * antiguo. Misma mecánica que R96.98 (1 spin por IP/fingerprint cada
 * 24h · backend /api/ruleta/spin sin cambios) · solo cambia el look
 * para integrarse al estilo isla del náufrago.
 *
 * Stack visual ·
 *  - backdrop sunset glow (no plain blur) · matchea env preset escena
 *  - card · panel pergamino con bordes irregulares + drop shadow burnt
 *  - rueda · 8 pegs sobresaliendo (rueda de timón) · madera tallada
 *  - separadores radiales entre gajos · estilo carved wood
 *  - hub · rosa de los vientos minimal
 *  - pointer · aguja de timón con punta
 *  - botón "Girar" · letrero de madera estilo sign NÁUFRAGO
 */

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { useCart } from "@/lib/v2/cart-context"

type Phase = "idle" | "spinning" | "result" | "cooldown" | "error"

interface SpinResponse {
  ok: boolean
  prize?: string
  prizeKey?: string
  prizeIndex?: number
  alreadyPlayed?: boolean
  lastPrize?: string
  hoursUntilNext?: number
  error?: string
}

interface Gajo {
  key: "chifle" | "pan" | "cola" | "siga"
  label: string
  bg: string
  ink: string
}

// Paleta Náufrago + neutro envejecido + madera. Los gajos siga
// participando usan un sand más apagado (no neutro frío gris) para
// no romper la paleta cálida del pergamino.
const GAJOS: Gajo[] = [
  { key: "chifle", label: "Chifle\ngratis", bg: "#4DD4D8", ink: "#0d0a06" },
  { key: "siga", label: "Sigue\nintentando", bg: "#D6C9A8", ink: "#3D2466" },
  { key: "pan", label: "Pan\ngratis", bg: "#FAF6EA", ink: "#3D2466" },
  { key: "siga", label: "Sigue\nintentando", bg: "#D6C9A8", ink: "#3D2466" },
  { key: "cola", label: "Cola\ngratis", bg: "#3D2466", ink: "#F5E9D2" },
  { key: "siga", label: "Sigue\nintentando", bg: "#D6C9A8", ink: "#3D2466" },
  { key: "chifle", label: "Chifle\ngratis", bg: "#4DD4D8", ink: "#0d0a06" },
  { key: "pan", label: "Pan\ngratis", bg: "#FAF6EA", ink: "#3D2466" },
]

const WOOD = "#8B5A2B"
const WOOD_DARK = "#4a2d12"
const WOOD_HI = "#b07a47"
const PARCH = "#F2E1B8"
const PARCH_DARK = "#C9A95E"
const INK = "#3D2466"

const SEG_DEG = 360 / GAJOS.length

// R96.103 · mapeo premio → línea de carrito · precio 0 (gratis).
// Cuando el usuario gana · se agrega automáticamente al carrito como
// regalo (qty incrementa si el cliente vuelve a ganar el mismo · 24h
// cooldown server-side limita en práctica a 1 spin/día).
const PRIZE_TO_CART_ITEM: Record<
  "chifle" | "pan" | "cola",
  { id: string; name: string }
> = {
  chifle: { id: "prize-chifle", name: "Chifle (🎁 Regalo)" },
  pan: { id: "prize-pan", name: "Pan (🎁 Regalo)" },
  cola: { id: "prize-cola", name: "Cola (🎁 Regalo)" },
}

function getFingerprint(): string {
  if (typeof window === "undefined") return "ssr"
  const key = "naufrago_ruleta_fp"
  let fp = window.localStorage.getItem(key)
  if (!fp) {
    fp =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `fp_${Date.now()}_${Math.random().toString(36).slice(2)}`
    window.localStorage.setItem(key, fp)
  }
  return fp
}

// SVG del timón completo · todo dentro de un SVG que rota como un
// solo cuerpo · gajos pie-slices + spokes (rayos) + labels grandes
// con stroke + 8 mangos (pegs) sobresaliendo del aro exterior + hub
// central con rosa de los vientos. ViewBox -180 a 180 · 360 unidades.
function HelmWheelSVG({ rotation, phase }: { rotation: number; phase: Phase }) {
  const R_OUTER = 132 // exterior gajos
  const R_INNER = 35 // hub
  const R_PEG_BASE = 150 // donde nace el peg desde el aro
  const R_PEG_KNOB = 168 // posición del knob exterior

  // Helper para path de pie-slice
  const slicePath = (i: number) => {
    const a1 = (-90 + i * SEG_DEG) * (Math.PI / 180)
    const a2 = (-90 + (i + 1) * SEG_DEG) * (Math.PI / 180)
    const x1 = R_OUTER * Math.cos(a1)
    const y1 = R_OUTER * Math.sin(a1)
    const x2 = R_OUTER * Math.cos(a2)
    const y2 = R_OUTER * Math.sin(a2)
    return `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R_OUTER} ${R_OUTER} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`
  }

  return (
    <motion.svg
      width={360}
      height={360}
      viewBox="-180 -180 360 360"
      style={{ filter: "drop-shadow(0 6px 16px rgba(0,0,0,0.45))" }}
      animate={{ rotate: rotation }}
      transition={{
        duration: phase === "spinning" ? 3.4 : 0,
        ease: [0.22, 0.61, 0.36, 1],
      }}
    >
      <defs>
        {/* Wood radial · usado en hub + knobs */}
        <radialGradient id="woodKnob" cx="35%" cy="32%" r="65%">
          <stop offset="0%" stopColor={WOOD_HI} />
          <stop offset="55%" stopColor={WOOD} />
          <stop offset="100%" stopColor={WOOD_DARK} />
        </radialGradient>
        {/* Wood linear · usado en peg shafts */}
        <linearGradient id="woodPeg" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={WOOD_DARK} />
          <stop offset="40%" stopColor={WOOD_HI} />
          <stop offset="100%" stopColor={WOOD_DARK} />
        </linearGradient>
        {/* Outer rim wood */}
        <radialGradient id="rimWood" cx="50%" cy="50%" r="50%">
          <stop offset="92%" stopColor={WOOD} />
          <stop offset="100%" stopColor={WOOD_DARK} />
        </radialGradient>
        {/* Subtle inner shadow via radial in gajos */}
        <radialGradient id="innerShade" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="rgba(74,45,18,0)" />
          <stop offset="100%" stopColor="rgba(74,45,18,0.35)" />
        </radialGradient>
      </defs>

      {/* Aro exterior tallado · ring de madera */}
      <circle
        cx={0}
        cy={0}
        r={R_OUTER + 8}
        fill="url(#rimWood)"
        stroke={WOOD_DARK}
        strokeWidth={2}
      />
      <circle
        cx={0}
        cy={0}
        r={R_OUTER + 8}
        fill="none"
        stroke={WOOD_DARK}
        strokeWidth={1}
        opacity={0.4}
      />

      {/* 8 pegs (mangos) sobresaliendo del aro · radial */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angleDeg = -90 + i * SEG_DEG // alineados con bordes gajos
        return (
          <g key={`peg-${i}`} transform={`rotate(${angleDeg})`}>
            {/* Shaft */}
            <rect
              x={-7}
              y={-R_PEG_KNOB}
              width={14}
              height={R_PEG_KNOB - R_PEG_BASE + 8}
              rx={3}
              fill="url(#woodPeg)"
              stroke={WOOD_DARK}
              strokeWidth={1.3}
            />
            {/* Knob · bola exterior */}
            <circle
              cx={0}
              cy={-R_PEG_KNOB}
              r={11}
              fill="url(#woodKnob)"
              stroke={WOOD_DARK}
              strokeWidth={1.5}
            />
            {/* Highlight in knob */}
            <circle
              cx={-3}
              cy={-R_PEG_KNOB - 3}
              r={3}
              fill={WOOD_HI}
              opacity={0.55}
            />
          </g>
        )
      })}

      {/* Pie slices (gajos) */}
      {GAJOS.map((g, i) => (
        <path
          key={`slice-${i}`}
          d={slicePath(i)}
          fill={g.bg}
          stroke={WOOD_DARK}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      ))}

      {/* Inner shade overlay · simula tallado / vejez */}
      <circle
        cx={0}
        cy={0}
        r={R_OUTER}
        fill="url(#innerShade)"
        pointerEvents="none"
      />

      {/* Spokes (rayos) · 8 lineas desde el hub al aro */}
      {Array.from({ length: 8 }).map((_, i) => {
        const a = (-90 + i * SEG_DEG) * (Math.PI / 180)
        const x = R_OUTER * Math.cos(a)
        const y = R_OUTER * Math.sin(a)
        return (
          <line
            key={`spoke-${i}`}
            x1={0}
            y1={0}
            x2={x}
            y2={y}
            stroke={WOOD_DARK}
            strokeWidth={2.5}
            strokeLinecap="round"
            opacity={0.85}
          />
        )
      })}

      {/* Labels · R96.101 · font 17→12 + letter-spacing 0.06→0.01 +
          radio 78→88 para acomodar el texto dentro del arco del gajo.
          Sin overflow visible sobre las separaciones radiales. */}
      {GAJOS.map((g, i) => {
        const midDeg = -90 + i * SEG_DEG + SEG_DEG / 2
        const rad = midDeg * (Math.PI / 180)
        const labelRadius = 88
        const cx = labelRadius * Math.cos(rad)
        const cy = labelRadius * Math.sin(rad)
        const lines = g.label.split("\n")
        const isDark = g.bg === "#3D2466"
        return (
          <g
            key={`label-${i}`}
            transform={`translate(${cx.toFixed(2)} ${cy.toFixed(2)}) rotate(${midDeg + 90})`}
          >
            {lines.map((line, j) => {
              const dy = lines.length === 1 ? 4 : j === 0 ? -4 : 10
              return (
                <text
                  key={j}
                  x={0}
                  y={dy}
                  textAnchor="middle"
                  style={{
                    fontFamily:
                      'var(--font-bebas), "Bebas Neue", sans-serif',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.01em",
                    paintOrder: "stroke fill",
                  }}
                  stroke={isDark ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.8)"}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                  fill={g.ink}
                >
                  {line.toUpperCase()}
                </text>
              )
            })}
          </g>
        )
      })}

      {/* Hub central · rosa de los vientos */}
      <circle
        cx={0}
        cy={0}
        r={R_INNER}
        fill="url(#woodKnob)"
        stroke={WOOD_DARK}
        strokeWidth={3}
      />
      {/* Estrella 4-puntas */}
      <g>
        <polygon
          points={`0,${-R_INNER + 4} 4,-3 0,0 -4,-3`}
          fill={PARCH}
          opacity={0.95}
        />
        <polygon
          points={`0,${R_INNER - 4} 4,3 0,0 -4,3`}
          fill={PARCH}
          opacity={0.65}
        />
        <polygon
          points={`${-R_INNER + 4},0 -3,4 0,0 -3,-4`}
          fill={PARCH}
          opacity={0.65}
        />
        <polygon
          points={`${R_INNER - 4},0 3,4 0,0 3,-4`}
          fill={PARCH}
          opacity={0.65}
        />
      </g>
      {/* Hub center bolt */}
      <circle cx={0} cy={0} r={4} fill={WOOD_DARK} />
    </motion.svg>
  )
}

interface RuletaModalProps {
  open: boolean
  onClose: () => void
}

export default function RuletaModal({ open, onClose }: RuletaModalProps) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [rotation, setRotation] = useState(0)
  const [prize, setPrize] = useState<string | null>(null)
  const [cooldownHours, setCooldownHours] = useState<number | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const cumulativeRotRef = useRef(0)
  const cart = useCart()

  useEffect(() => {
    if (open) {
      setPhase("idle")
      setPrize(null)
      setCooldownHours(null)
      setErrorMsg(null)
      setRotation(0)
      cumulativeRotRef.current = 0
    }
  }, [open])

  async function handleSpin() {
    if (phase !== "idle") return
    setPhase("spinning")
    setErrorMsg(null)
    try {
      const res = await fetch("/api/ruleta/spin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fingerprint: getFingerprint() }),
      })
      const data = (await res.json()) as SpinResponse

      if (!data.ok && data.alreadyPlayed) {
        setCooldownHours(data.hoursUntilNext ?? 24)
        setPrize(data.lastPrize ?? null)
        setPhase("cooldown")
        return
      }

      if (!data.ok || data.prizeIndex === undefined) {
        setErrorMsg("No se pudo girar · intenta de nuevo")
        setPhase("error")
        return
      }

      const TURNS = 5
      const target =
        TURNS * 360 - data.prizeIndex * SEG_DEG - SEG_DEG / 2
      cumulativeRotRef.current = target
      setRotation(target)

      window.setTimeout(() => {
        setPrize(data.prize ?? null)
        setPhase("result")
        // R96.103 · adjuntar el premio al carrito como regalo gratis ·
        // solo cuando el premio es un ítem real (chifle · pan · cola) ·
        // "siga" no agrega nada.
        if (
          data.prizeKey === "chifle" ||
          data.prizeKey === "pan" ||
          data.prizeKey === "cola"
        ) {
          const item = PRIZE_TO_CART_ITEM[data.prizeKey]
          cart.add({ id: item.id, name: item.name, priceUsd: 0 }, 1)
        }
      }, 3500)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido")
      setPhase("error")
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            // Sunset glow backdrop · matchea Environment preset de la escena.
            background:
              "radial-gradient(circle at 50% 35%, rgba(255,180,90,0.35) 0%, rgba(40,20,60,0.85) 50%, rgba(8,5,20,0.95) 100%)",
            backdropFilter: "blur(4px)",
          }}
        >
          <motion.div
            className="relative w-full max-w-md"
            initial={{ scale: 0.85, y: 28 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 28 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Card pergamino · esquinas irregulares + textura via box-shadow inset */}
            <div
              className="relative px-6 pb-6 pt-7"
              style={{
                background: `
                  radial-gradient(ellipse at 20% 0%, ${PARCH} 0%, ${PARCH_DARK} 100%)
                `,
                borderRadius: "18px 26px 22px 30px / 28px 18px 26px 20px",
                boxShadow: `
                  inset 0 0 60px rgba(120, 80, 30, 0.18),
                  inset 0 0 0 2px ${WOOD_DARK}cc,
                  0 8px 24px rgba(0,0,0,0.5),
                  0 0 0 1px rgba(0,0,0,0.2)
                `,
              }}
            >
              {/* Esquinas chamuscadas · 4 manchas radiales en corners */}
              {[
                "top-0 left-0",
                "top-0 right-0",
                "bottom-0 left-0",
                "bottom-0 right-0",
              ].map((pos, i) => (
                <div
                  key={i}
                  className={`absolute ${pos} pointer-events-none`}
                  style={{
                    width: 90,
                    height: 90,
                    background:
                      "radial-gradient(circle, rgba(74,45,18,0.35) 0%, transparent 70%)",
                  }}
                />
              ))}

              <button
                type="button"
                onClick={onClose}
                className="absolute right-3 top-3 z-20 rounded-full bg-[#4a2d12]/15 p-1.5 text-[#4a2d12] transition hover:bg-[#4a2d12]/30"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>

              <h2
                className="text-center text-3xl tracking-wider"
                style={{
                  fontFamily: "var(--font-bebas), sans-serif",
                  color: WOOD_DARK,
                  textShadow: "0 1px 0 rgba(255,255,255,0.4)",
                  letterSpacing: "0.05em",
                }}
              >
                Cofre del Náufrago
              </h2>
              <p
                className="mt-0.5 text-center text-base"
                style={{
                  fontFamily: '"Caveat", "Brush Script MT", cursive',
                  color: INK,
                  opacity: 0.85,
                }}
              >
                gira el timón · una vez por día
              </p>

              {/* Timón completo en SVG · 360x360 · rota como un solo
                  cuerpo (aro · pegs · gajos · spokes · labels · hub). */}
              <div className="relative mx-auto mt-4 flex h-[360px] w-[360px] items-center justify-center">
                <HelmWheelSVG rotation={rotation} phase={phase} />

                {/* Pointer · aguja arriba · estilo tallada · NO rota */}
                <div
                  className="absolute z-20 left-1/2 -translate-x-1/2"
                  style={{ top: 2 }}
                >
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "14px solid transparent",
                      borderRight: "14px solid transparent",
                      borderTop: `32px solid ${WOOD_DARK}`,
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.55))",
                    }}
                  />
                  {/* Pivote bola */}
                  <div
                    className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      width: 16,
                      height: 16,
                      background: `radial-gradient(circle at 35% 30%, ${WOOD_HI}, ${WOOD_DARK})`,
                      border: `1.5px solid ${WOOD_DARK}`,
                      boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
                    }}
                  />
                </div>
              </div>

              {/* CTA / result · letrero de madera estilo sign NÁUFRAGO */}
              <div className="mt-5 min-h-[96px]">
                {phase === "idle" && (
                  <button
                    type="button"
                    onClick={handleSpin}
                    className="group relative mx-auto block w-full max-w-[240px] py-3 transition active:scale-[0.97]"
                    style={{
                      background: `linear-gradient(180deg, ${WOOD_HI} 0%, ${WOOD} 50%, ${WOOD_DARK} 100%)`,
                      border: `2px solid ${WOOD_DARK}`,
                      borderRadius: "10px 14px 10px 14px",
                      boxShadow: `
                        inset 0 1px 0 rgba(255,255,255,0.2),
                        inset 0 -2px 0 ${WOOD_DARK},
                        0 4px 12px rgba(0,0,0,0.4)
                      `,
                      color: PARCH,
                      fontFamily: "var(--font-bebas), sans-serif",
                      fontSize: 22,
                      letterSpacing: "0.1em",
                      textShadow: "0 1px 2px rgba(0,0,0,0.5)",
                    }}
                  >
                    GIRAR EL TIMÓN
                  </button>
                )}
                {phase === "spinning" && (
                  <p
                    className="text-center text-lg"
                    style={{
                      fontFamily: '"Caveat", cursive',
                      color: INK,
                    }}
                  >
                    El viento gira las velas...
                  </p>
                )}
                {phase === "result" && prize && (
                  <div className="text-center">
                    <p
                      className="text-sm uppercase tracking-widest"
                      style={{ color: WOOD_DARK, opacity: 0.7 }}
                    >
                      Has encontrado
                    </p>
                    <p
                      className="mt-1 text-3xl"
                      style={{
                        fontFamily: "var(--font-bebas), sans-serif",
                        color: INK,
                        letterSpacing: "0.04em",
                      }}
                    >
                      {prize}
                    </p>
                    <p
                      className="mt-2 text-base"
                      style={{
                        fontFamily: '"Caveat", cursive',
                        color: INK,
                        opacity: 0.85,
                      }}
                    >
                      {prize === "Sigue intentando" ||
                      prize === "Siga participando"
                        ? "vuelve mañana, marinero"
                        : "ya añadimos tu regalo al carrito · gratis"}
                    </p>
                  </div>
                )}
                {phase === "cooldown" && (
                  <div className="text-center">
                    <p
                      className="text-xl"
                      style={{
                        fontFamily: "var(--font-bebas), sans-serif",
                        color: WOOD_DARK,
                        letterSpacing: "0.05em",
                      }}
                    >
                      ya giraste el timón hoy
                    </p>
                    {prize && (
                      <p
                        className="mt-1 text-base"
                        style={{
                          fontFamily: '"Caveat", cursive',
                          color: INK,
                        }}
                      >
                        tu último botín fue · <strong>{prize}</strong>
                      </p>
                    )}
                    <p
                      className="mt-2 text-sm"
                      style={{
                        fontFamily: '"Caveat", cursive',
                        color: INK,
                        opacity: 0.8,
                      }}
                    >
                      vuelve en {cooldownHours ?? 24}h por otra oportunidad
                    </p>
                  </div>
                )}
                {phase === "error" && (
                  <div className="text-center">
                    <p className="text-sm" style={{ color: "#8b1c1c" }}>
                      {errorMsg ?? "Error desconocido"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setPhase("idle")}
                      className="mt-2 text-xs underline"
                      style={{ color: INK }}
                    >
                      intentar de nuevo
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
