"use client"

/**
 * RuletaModal · R96.98 · cofre del tesoro · ruleta giratoria de premios.
 *
 * - 1 spin por IP/fingerprint cada 24h (gate server-side).
 * - 8 gajos · 2 de cada premio (chifle · pan · cola · siga participando).
 * - Paleta · Náufrago #3D2466 (purple) · #4DD4D8 (cyan) · #F5E9D2 (sand)
 *   + neutro #E5E5E5 + madera #8B5A2B borde + centro.
 * - Lands en el ángulo del prize_index devuelto por el endpoint.
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

// 8 gajos · 2 de cada premio · orden visual fijo. El prizeIndex 0-3 del
// backend mapea al primer gajo que tenga ese key (todas las dos
// instancias representan el mismo premio).
const GAJOS: Gajo[] = [
  { key: "chifle", label: "Chifle\ngratis", bg: "#4DD4D8", ink: "#0d0a06" }, // cyan
  { key: "siga", label: "Siga\nparticipando", bg: "#E5E5E5", ink: "#3D2466" }, // neutro
  { key: "pan", label: "Pan\ngratis", bg: "#F5E9D2", ink: "#3D2466" }, // sand
  { key: "siga", label: "Siga\nparticipando", bg: "#E5E5E5", ink: "#3D2466" }, // neutro
  { key: "cola", label: "Cola\ngratis", bg: "#3D2466", ink: "#F5E9D2" }, // purple
  { key: "siga", label: "Siga\nparticipando", bg: "#E5E5E5", ink: "#3D2466" }, // neutro
  { key: "chifle", label: "Chifle\ngratis", bg: "#4DD4D8", ink: "#0d0a06" }, // cyan
  { key: "pan", label: "Pan\ngratis", bg: "#F5E9D2", ink: "#3D2466" }, // sand
]

const WOOD = "#8B5A2B"
const WOOD_DARK = "#5C3A1A"
const SEG_DEG = 360 / GAJOS.length // 45deg

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

// Build the conic-gradient string · cada gajo ocupa SEG_DEG grados.
function conicGradient(): string {
  const stops: string[] = []
  GAJOS.forEach((g, i) => {
    const start = i * SEG_DEG
    const end = (i + 1) * SEG_DEG
    stops.push(`${g.bg} ${start}deg ${end}deg`)
  })
  return `conic-gradient(from -90deg, ${stops.join(", ")})`
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

  // Reset state cuando se abre el modal (no en cada render).
  useEffect(() => {
    if (open) {
      setPhase("idle")
      setPrize(null)
      setCooldownHours(null)
      setErrorMsg(null)
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
        // Detener la animación inmediato · no spin permitido.
        setPhase("cooldown")
        return
      }

      if (!data.ok || data.prizeIndex === undefined) {
        setErrorMsg("No se pudo girar · intenta de nuevo")
        setPhase("error")
        return
      }

      // Animate rotation · 5 full turns + land on prizeIndex center.
      // El gajo 0 está arriba (from -90deg) · su centro está en
      // angle = SEG_DEG/2 desde la posición 0 (arriba). Para que el
      // pointer (que apunta arriba) marque el gajo i · el círculo
      // debe rotar -i*SEG_DEG - SEG_DEG/2.
      const TURNS = 5
      const target =
        TURNS * 360 - data.prizeIndex * SEG_DEG - SEG_DEG / 2
      cumulativeRotRef.current = target
      setRotation(target)

      // Tras la animación (3.4s) · mostrar resultado.
      window.setTimeout(() => {
        setPrize(data.prize ?? null)
        setPhase("result")
      }, 3500)
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Error desconocido",
      )
      setPhase("error")
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-md rounded-3xl bg-gradient-to-b from-[#F5E9D2] to-[#E6D3AE] p-6 shadow-2xl"
            initial={{ scale: 0.85, y: 24 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 24 }}
            transition={{ type: "spring", damping: 22, stiffness: 240 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-black/10 p-1.5 text-[#3D2466] transition hover:bg-black/20"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-center font-serif text-2xl font-bold text-[#3D2466]">
              Cofre del Náufrago
            </h2>
            <p className="mt-1 text-center text-sm text-[#3D2466]/80">
              Gira la rueda · 1 vez por día
            </p>

            {/* Ruleta · 320px · wood frame + conic gradient + pointer */}
            <div className="relative mx-auto mt-5 flex h-[320px] w-[320px] items-center justify-center">
              {/* Wood frame · outer ring */}
              <div
                className="absolute inset-0 rounded-full shadow-inner"
                style={{
                  background: `radial-gradient(circle at 50% 50%, ${WOOD} 0%, ${WOOD} 70%, ${WOOD_DARK} 100%)`,
                  padding: 16,
                }}
              />
              {/* Spinning disc */}
              <motion.div
                className="relative h-[280px] w-[280px] rounded-full shadow-lg"
                style={{
                  background: gradient,
                  border: `4px solid ${WOOD_DARK}`,
                }}
                animate={{ rotate: rotation }}
                transition={{
                  duration: phase === "spinning" ? 3.4 : 0,
                  ease: [0.22, 0.61, 0.36, 1],
                }}
              >
                {/* Labels per gajo */}
                {GAJOS.map((g, i) => {
                  const angle = i * SEG_DEG + SEG_DEG / 2
                  return (
                    <div
                      key={i}
                      className="absolute left-1/2 top-1/2 origin-left text-center text-[11px] font-bold leading-tight"
                      style={{
                        transform: `translate(0, -50%) rotate(${angle - 90}deg) translateX(40px)`,
                        color: g.ink,
                        width: 90,
                        whiteSpace: "pre-line",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-block",
                          transform: `rotate(90deg)`,
                        }}
                      >
                        {g.label}
                      </span>
                    </div>
                  )
                })}
                {/* Center hub · wood */}
                <div
                  className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md"
                  style={{
                    background: `radial-gradient(circle at 40% 35%, ${WOOD} 0%, ${WOOD_DARK} 100%)`,
                    border: `3px solid ${WOOD_DARK}`,
                  }}
                />
              </motion.div>

              {/* Pointer · arriba · apunta hacia el centro */}
              <div
                className="absolute -top-1 left-1/2 -translate-x-1/2 z-10"
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: "14px solid transparent",
                  borderRight: "14px solid transparent",
                  borderTop: `26px solid ${WOOD_DARK}`,
                  filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.35))",
                }}
              />
            </div>

            {/* CTA / result area */}
            <div className="mt-5 min-h-[88px]">
              {phase === "idle" && (
                <button
                  type="button"
                  onClick={handleSpin}
                  className="w-full rounded-full bg-gradient-to-r from-[#3D2466] to-[#4DD4D8] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:scale-[1.02] active:scale-[0.98]"
                >
                  ¡Girar la rueda!
                </button>
              )}
              {phase === "spinning" && (
                <p className="text-center text-base font-medium text-[#3D2466]">
                  Girando...
                </p>
              )}
              {phase === "result" && prize && (
                <div className="text-center">
                  <p className="text-sm text-[#3D2466]/70">¡Ganaste!</p>
                  <p className="mt-1 text-2xl font-bold text-[#3D2466]">
                    {prize}
                  </p>
                  <p className="mt-2 text-xs text-[#3D2466]/70">
                    {prize === "Siga participando"
                      ? "Vuelve mañana para otra oportunidad"
                      : "Aplica este premio en tu próximo pedido por WhatsApp"}
                  </p>
                </div>
              )}
              {phase === "cooldown" && (
                <div className="text-center">
                  <p className="text-base font-semibold text-[#3D2466]">
                    Ya jugaste hoy
                  </p>
                  {prize && (
                    <p className="mt-1 text-sm text-[#3D2466]/80">
                      Último premio · <strong>{prize}</strong>
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[#3D2466]/70">
                    Vuelve en {cooldownHours ?? 24}h para otra oportunidad
                  </p>
                </div>
              )}
              {phase === "error" && (
                <div className="text-center">
                  <p className="text-sm text-red-700">
                    {errorMsg ?? "Error desconocido"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setPhase("idle")}
                    className="mt-2 text-xs text-[#3D2466] underline"
                  >
                    Intentar de nuevo
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
