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

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

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
  { key: "pan", label: "Pan\ngratis", bg: "#F5E9D2", ink: "#3D2466" },
  { key: "siga", label: "Sigue\nintentando", bg: "#D6C9A8", ink: "#3D2466" },
  { key: "cola", label: "Cola\ngratis", bg: "#3D2466", ink: "#F5E9D2" },
  { key: "siga", label: "Sigue\nintentando", bg: "#D6C9A8", ink: "#3D2466" },
  { key: "chifle", label: "Chifle\ngratis", bg: "#4DD4D8", ink: "#0d0a06" },
  { key: "pan", label: "Pan\ngratis", bg: "#F5E9D2", ink: "#3D2466" },
]

const WOOD = "#8B5A2B"
const WOOD_DARK = "#4a2d12"
const WOOD_HI = "#b07a47"
const PARCH = "#F2E1B8"
const PARCH_DARK = "#C9A95E"
const INK = "#3D2466"

const SEG_DEG = 360 / GAJOS.length

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

function conicGradient(): string {
  const stops: string[] = []
  GAJOS.forEach((g, i) => {
    const start = i * SEG_DEG
    const end = (i + 1) * SEG_DEG
    stops.push(`${g.bg} ${start}deg ${end}deg`)
  })
  return `conic-gradient(from -90deg, ${stops.join(", ")})`
}

// 8 mangos del timón · render absolute alrededor del disco.
function HelmPegs() {
  const pegs = []
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * 360 + 22.5 // offset 22.5 para alinear con bordes gajos
    pegs.push(
      <div
        key={i}
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-180px)`,
        }}
      >
        <div
          className="rounded-full"
          style={{
            width: 18,
            height: 60,
            background: `linear-gradient(180deg, ${WOOD_HI} 0%, ${WOOD} 40%, ${WOOD_DARK} 100%)`,
            border: `1.5px solid ${WOOD_DARK}`,
            boxShadow: `inset -2px 0 0 ${WOOD_DARK}40, 0 2px 4px rgba(0,0,0,0.4)`,
          }}
        />
        {/* knob extremo · bola tallada */}
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: 22,
            height: 22,
            background: `radial-gradient(circle at 35% 30%, ${WOOD_HI} 0%, ${WOOD} 55%, ${WOOD_DARK} 100%)`,
            border: `1.5px solid ${WOOD_DARK}`,
            boxShadow: "0 2px 3px rgba(0,0,0,0.4)",
          }}
        />
      </div>,
    )
  }
  return <>{pegs}</>
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

  const gradient = useMemo(() => conicGradient(), [])

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

              {/* Timón + ruleta · 360x360 */}
              <div className="relative mx-auto mt-4 flex h-[360px] w-[360px] items-center justify-center">
                {/* Outer rope ring · cuerda alrededor */}
                <div
                  className="absolute"
                  style={{
                    width: 340,
                    height: 340,
                    borderRadius: "50%",
                    background: "transparent",
                    border: `6px dashed ${WOOD_DARK}`,
                    opacity: 0.55,
                  }}
                />

                {/* 8 helm pegs · NO rotan (parte del frame) */}
                <HelmPegs />

                {/* Outer wood rim · ancho · estilo timón */}
                <div
                  className="absolute"
                  style={{
                    width: 300,
                    height: 300,
                    borderRadius: "50%",
                    background: `
                      radial-gradient(circle at 50% 50%,
                        transparent 0%,
                        transparent 130px,
                        ${WOOD} 132px,
                        ${WOOD_DARK} 150px
                      )
                    `,
                    boxShadow: `
                      inset 0 0 0 2px ${WOOD_DARK},
                      0 4px 12px rgba(0,0,0,0.4)
                    `,
                  }}
                />

                {/* Spinning disc · 260px */}
                <motion.div
                  className="relative"
                  style={{
                    width: 260,
                    height: 260,
                    borderRadius: "50%",
                    background: gradient,
                    boxShadow: `
                      inset 0 0 0 3px ${WOOD_DARK},
                      inset 0 0 30px rgba(74,45,18,0.25)
                    `,
                  }}
                  animate={{ rotate: rotation }}
                  transition={{
                    duration: phase === "spinning" ? 3.4 : 0,
                    ease: [0.22, 0.61, 0.36, 1],
                  }}
                >
                  {/* Separadores radiales entre gajos · líneas talladas */}
                  {GAJOS.map((_, i) => {
                    const angle = i * SEG_DEG
                    return (
                      <div
                        key={`sep-${i}`}
                        className="absolute left-1/2 top-1/2 origin-top"
                        style={{
                          width: 2,
                          height: 130,
                          background: `linear-gradient(180deg, ${WOOD_DARK} 0%, ${WOOD_DARK}99 100%)`,
                          transform: `translate(-50%, 0) rotate(${angle - 90 - SEG_DEG / 2}deg)`,
                          transformOrigin: "50% 0%",
                          left: "50%",
                          top: "50%",
                          marginLeft: -1,
                          marginTop: -130,
                        }}
                      />
                    )
                  })}

                  {/* Labels per gajo */}
                  {GAJOS.map((g, i) => {
                    const angle = i * SEG_DEG + SEG_DEG / 2
                    return (
                      <div
                        key={i}
                        className="absolute left-1/2 top-1/2 origin-left text-center font-bold leading-[1.05]"
                        style={{
                          transform: `translate(0, -50%) rotate(${angle - 90}deg) translateX(34px)`,
                          color: g.ink,
                          width: 86,
                          fontSize: 13,
                          whiteSpace: "pre-line",
                          fontFamily:
                            'var(--font-bebas), "Bebas Neue", sans-serif',
                          letterSpacing: "0.03em",
                          textShadow:
                            g.bg === "#3D2466"
                              ? "0 1px 0 rgba(0,0,0,0.3)"
                              : "0 1px 0 rgba(255,255,255,0.4)",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            transform: "rotate(90deg)",
                          }}
                        >
                          {g.label}
                        </span>
                      </div>
                    )
                  })}

                  {/* Hub central · rosa de los vientos */}
                  <div
                    className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full"
                    style={{
                      width: 64,
                      height: 64,
                      background: `radial-gradient(circle at 40% 32%, ${WOOD_HI} 0%, ${WOOD} 55%, ${WOOD_DARK} 100%)`,
                      border: `3px solid ${WOOD_DARK}`,
                      boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
                    }}
                  >
                    {/* Estrella N S E W */}
                    <svg width="34" height="34" viewBox="0 0 34 34">
                      <polygon
                        points="17,4 19,15 17,17 15,15"
                        fill={PARCH}
                        opacity="0.95"
                      />
                      <polygon
                        points="17,30 19,19 17,17 15,19"
                        fill={PARCH}
                        opacity="0.65"
                      />
                      <polygon
                        points="4,17 15,15 17,17 15,19"
                        fill={PARCH}
                        opacity="0.65"
                      />
                      <polygon
                        points="30,17 19,15 17,17 19,19"
                        fill={PARCH}
                        opacity="0.65"
                      />
                    </svg>
                  </div>
                </motion.div>

                {/* Pointer · aguja arriba · estilo tallada */}
                <div
                  className="absolute z-20 left-1/2 -translate-x-1/2"
                  style={{ top: -4 }}
                >
                  <div
                    style={{
                      width: 0,
                      height: 0,
                      borderLeft: "12px solid transparent",
                      borderRight: "12px solid transparent",
                      borderTop: `30px solid ${WOOD_DARK}`,
                      filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
                    }}
                  />
                  {/* Pivote bola */}
                  <div
                    className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full"
                    style={{
                      width: 14,
                      height: 14,
                      background: `radial-gradient(circle at 35% 30%, ${WOOD_HI}, ${WOOD_DARK})`,
                      border: `1.5px solid ${WOOD_DARK}`,
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
                        opacity: 0.8,
                      }}
                    >
                      {prize === "Sigue intentando" ||
                      prize === "Siga participando"
                        ? "vuelve mañana, marinero"
                        : "reclama tu premio en el próximo pedido"}
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
