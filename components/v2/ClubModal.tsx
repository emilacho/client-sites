"use client"
/**
 * ClubModal · R97.8 · "Náufrago Club"
 *
 * Suscripción mensual · info + waitlist email capture · payment recurring
 * via Kushki pending Sprint próximo. Por ahora captura emails para que
 * cuando active el Club tengamos lista pre-armada de interesados.
 */
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Check } from "lucide-react"

const PURPLE = "#3D2466"
const PURPLE_DARK = "#1F1138"
const CYAN = "#4DD4D8"
const SAND = "#F5E9D2"

export interface ClubModalProps {
  open: boolean
  onClose: () => void
}

const BENEFITS = [
  { emoji: "🚚", title: "Envío gratis", detail: "Hasta 4 pedidos al mes sin costo de motorizado." },
  { emoji: "🍹", title: "Jugo gratis siempre", detail: "1 jugo natural del día sumado a cada pedido · sin condición." },
  { emoji: "💎", title: "10% off acumulado", detail: "Descuento extra en cada pedido · acumulable con perlas y promos." },
  { emoji: "⚓", title: "Prioridad en cocina", detail: "Tu pedido se arma antes de los pedidos no-club · 10 min menos." },
  { emoji: "🏝", title: "Eventos exclusivos", detail: "Ceviches especiales, jornadas privadas en la playa, primer dibs de jugos raros." },
]

type Stage =
  | { kind: "info" }
  | { kind: "submitting" }
  | { kind: "joined"; email: string }
  | { kind: "error"; message: string }

export function ClubModal({ open, onClose }: ClubModalProps) {
  const [stage, setStage] = useState<Stage>({ kind: "info" })
  const [email, setEmail] = useState("")

  useEffect(() => {
    if (!open) return
    setStage({ kind: "info" })
    setEmail("")
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    if (stage.kind === "submitting") return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStage({ kind: "error", message: "Email inválido · revisá el formato" })
      return
    }
    setStage({ kind: "submitting" })
    try {
      const res = await fetch("/api/subscribers/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          source: "naufrago_club_waitlist",
          optInPromos: true,
          optInTracking: false,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.detail ?? json.error ?? "signup_failed")
      }
      setStage({ kind: "joined", email })
    } catch (err) {
      setStage({
        kind: "error",
        message: err instanceof Error ? err.message : "Error al sumar a la lista",
      })
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        key="club-root"
        className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: "8%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "8%", opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl md:rounded-3xl"
          style={{
            background: `linear-gradient(180deg, ${PURPLE} 0%, ${PURPLE_DARK} 100%)`,
            border: `3px solid ${CYAN}`,
            color: "#FFFFFF",
          }}
        >
          {/* Header */}
          <div className="relative px-5 pt-4 pb-3">
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/70 hover:bg-white/15 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="font-mono text-[10px] uppercase tracking-[0.22em] opacity-75">
              ✦ Suscripción · próximamente
            </span>
            <h2 className="mt-1 font-[family-name:var(--font-bebas),sans-serif] text-4xl tracking-wider">
              NÁUFRAGO CLUB
            </h2>
            <p
              className="mt-1 font-[family-name:var(--font-handwritten),cursive] text-base italic"
              style={{ color: CYAN }}
            >
              Para los que vuelven al puerto siempre
            </p>
          </div>

          {/* Body */}
          <div className="space-y-3 px-5 pb-5">
            {stage.kind === "joined" ? (
              <div
                className="space-y-2 rounded-2xl border-2 px-4 py-6 text-center"
                style={{ background: "rgba(77,212,216,0.10)", borderColor: CYAN }}
              >
                <Check className="mx-auto h-8 w-8" style={{ color: CYAN }} />
                <p
                  className="font-[family-name:var(--font-bebas),sans-serif] text-2xl tracking-wider"
                  style={{ color: CYAN }}
                >
                  ¡EN LA LISTA!
                </p>
                <p className="text-sm">
                  Te avisamos a <span className="font-mono">{stage.email}</span>{" "}
                  cuando el Club arranque.
                </p>
                <p className="text-[11px] opacity-60">
                  Los primeros 50 reciben 1 mes gratis.
                </p>
              </div>
            ) : (
              <>
                {/* Precio teaser */}
                <div
                  className="flex items-baseline gap-2 rounded-2xl px-3 py-2.5"
                  style={{
                    background: "rgba(77,212,216,0.10)",
                    border: "1px solid rgba(77,212,216,0.30)",
                  }}
                >
                  <span
                    className="font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wider"
                    style={{ color: CYAN }}
                  >
                    $9.99
                  </span>
                  <span className="text-sm opacity-70">/mes</span>
                  <span className="ml-auto text-[10px] opacity-60">
                    Cancelás cuando quieras
                  </span>
                </div>

                {/* Benefits list */}
                <ul className="space-y-2">
                  {BENEFITS.map((b, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="text-xl">{b.emoji}</span>
                      <div className="flex-1">
                        <span className="block text-sm font-semibold" style={{ color: SAND }}>
                          {b.title}
                        </span>
                        <span className="block text-[11px] opacity-75">
                          {b.detail}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Waitlist form · payment recurring pending */}
                <div
                  className="rounded-2xl px-3 py-3"
                  style={{
                    background: "rgba(245,233,210,0.08)",
                    border: "1px solid rgba(245,233,210,0.20)",
                  }}
                >
                  <p className="mb-2 text-[11px] opacity-80">
                    🚧 Arrancamos pronto · sumate a la lista de espera ·
                    primeros 50 reciben{" "}
                    <strong style={{ color: CYAN }}>1 mes gratis</strong>.
                  </p>
                  <form onSubmit={handleJoin} className="space-y-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="tu@email.com"
                      required
                      disabled={stage.kind === "submitting"}
                      className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-cyan-400 focus:outline-none"
                    />
                    {stage.kind === "error" ? (
                      <p className="text-[11px]" style={{ color: "#FCA5A5" }}>
                        {stage.message}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={stage.kind === "submitting"}
                      style={{
                        background: `linear-gradient(90deg, ${CYAN} 0%, #2BA8AC 100%)`,
                        color: PURPLE,
                      }}
                      className="w-full rounded-full py-2.5 text-sm font-bold disabled:opacity-70"
                    >
                      {stage.kind === "submitting" ? "Sumando..." : "Sumarme a la lista"}
                    </button>
                  </form>
                </div>

                <p className="text-center text-[10px] opacity-50">
                  Sin cargos hasta que arranque el Club · email solo para
                  avisarte el lanzamiento.
                </p>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
