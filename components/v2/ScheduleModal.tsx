"use client"
/**
 * ScheduleModal · R97.8.5 · "Reservar para una hora"
 *
 * Cliente elige fecha + hora CUSTOM con input datetime-local nativo ·
 * browser muestra su propio picker (calendario + reloj con keyboard
 * support). Plus 3 quick presets para selección rápida.
 *
 * Validación · debe ser futura (+30min mínimo · cocina prep time) ·
 * debe estar dentro de horario 11:00-22:00 (cocina abierta).
 *
 * Persiste en localStorage 'naufrago_schedule_target' · cart drawer
 * respeta esta hora cuando dispatcha el pedido.
 */
import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Clock, Check } from "lucide-react"

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const LS_KEY = "naufrago_schedule_target"

const KITCHEN_OPEN_H = 11
const KITCHEN_CLOSE_H = 22
const MIN_LEAD_MINUTES = 30

interface ScheduleTarget {
  targetIso: string
  storedAt: string
}

function fmtDateTimeLocal(d: Date): string {
  // input type=datetime-local · format YYYY-MM-DDTHH:MM (sin segundos ni zona)
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtPretty(d: Date): string {
  return d.toLocaleString("es-EC", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function validateTarget(d: Date | null): { ok: boolean; error?: string } {
  if (!d || isNaN(d.getTime())) return { ok: false, error: "Hora inválida" }
  const now = new Date()
  const minTime = new Date(now.getTime() + MIN_LEAD_MINUTES * 60_000)
  if (d < minTime) {
    return {
      ok: false,
      error: `Necesitamos al menos ${MIN_LEAD_MINUTES} min para preparar tu pedido`,
    }
  }
  const h = d.getHours()
  if (h < KITCHEN_OPEN_H || h >= KITCHEN_CLOSE_H) {
    return {
      ok: false,
      error: `Cocina abierta ${KITCHEN_OPEN_H}:00 - ${KITCHEN_CLOSE_H}:00 · elegí otra hora`,
    }
  }
  return { ok: true }
}

export interface ScheduleModalProps {
  open: boolean
  onClose: () => void
}

export function ScheduleModal({ open, onClose }: ScheduleModalProps) {
  const [value, setValue] = useState<string>("")
  const [success, setSuccess] = useState(false)

  // Defaults · próximos 30 min · +1h · +2h
  const presets = useMemo(() => {
    const now = new Date()
    const make = (mins: number) => {
      const d = new Date(now.getTime() + mins * 60_000)
      // Round up to nearest 15 min
      const m = d.getMinutes()
      const rounded = Math.ceil(m / 15) * 15
      d.setMinutes(rounded, 0, 0)
      if (rounded === 60) {
        d.setHours(d.getHours() + 1)
        d.setMinutes(0)
      }
      return d
    }
    return [
      { label: "En 30 min", date: make(30) },
      { label: "En 1 hora", date: make(60) },
      { label: "En 2 horas", date: make(120) },
    ]
  }, [open]) // recompute on open

  useEffect(() => {
    if (!open) return
    setSuccess(false)
    // Pre-fill con localStorage si existe · sino default a presets[1] (en 1h)
    try {
      const stored = window.localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ScheduleTarget
        const d = new Date(parsed.targetIso)
        if (!isNaN(d.getTime()) && d > new Date()) {
          setValue(fmtDateTimeLocal(d))
          return
        }
      }
    } catch {
      // ignore
    }
    setValue(fmtDateTimeLocal(presets[1].date))
  }, [open, presets])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!open) return null

  const parsedDate = value ? new Date(value) : null
  const validation = validateTarget(parsedDate)

  function handlePresetClick(date: Date) {
    setValue(fmtDateTimeLocal(date))
  }

  function handleSave() {
    if (!validation.ok || !parsedDate) return
    try {
      const payload: ScheduleTarget = {
        targetIso: parsedDate.toISOString(),
        storedAt: new Date().toISOString(),
      }
      window.localStorage.setItem(LS_KEY, JSON.stringify(payload))
    } catch {
      // ignore
    }
    setSuccess(true)
    window.setTimeout(() => onClose(), 1800)
  }

  function handleClear() {
    try {
      window.localStorage.removeItem(LS_KEY)
    } catch {
      // ignore
    }
    setValue("")
  }

  // Bounds para el input · solo hoy + mañana + pasado · dentro de horario
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const minBound = new Date(Date.now() + MIN_LEAD_MINUTES * 60_000)
  const maxBound = new Date(todayStart.getTime() + 3 * 24 * 60 * 60_000)
  maxBound.setHours(KITCHEN_CLOSE_H, 0, 0, 0)

  return (
    <AnimatePresence>
      <motion.div
        key="schedule-root"
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
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        />
        <motion.div
          initial={{ y: "8%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "8%", opacity: 0 }}
          transition={{ duration: 0.28 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl bg-slate-950 px-5 py-5 text-slate-100 md:rounded-3xl"
          style={{ border: `2px solid ${PURPLE}` }}
        >
          <header className="mb-4 flex items-start justify-between gap-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-cyan-300">
                Reservar horario
              </span>
              <h2
                className="mt-1 font-[family-name:var(--font-bebas),sans-serif] text-3xl tracking-wider"
                style={{ color: "#FFFFFF" }}
              >
                ELEGÍ TU HORA
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Cocina abierta {KITCHEN_OPEN_H}:00 - {KITCHEN_CLOSE_H}:00 · mínimo +
                {MIN_LEAD_MINUTES} min desde ahora.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          {success ? (
            <div
              className="space-y-2 rounded-2xl border-2 px-4 py-6 text-center"
              style={{
                background: "rgba(77,212,216,0.10)",
                borderColor: CYAN,
              }}
            >
              <Check className="mx-auto h-8 w-8" style={{ color: CYAN }} />
              <p
                className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wider"
                style={{ color: CYAN }}
              >
                RESERVADO
              </p>
              <p className="text-sm capitalize text-slate-200">
                {parsedDate ? fmtPretty(parsedDate) : ""}
              </p>
              <p className="text-[11px] text-slate-500">
                Al hacer el pedido vamos a respetar esta hora.
              </p>
            </div>
          ) : (
            <>
              {/* Quick presets · 3 botones rápidos */}
              <div className="mb-3">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  Quick · una mano
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {presets.map((p) => {
                    const isSelected = value === fmtDateTimeLocal(p.date)
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handlePresetClick(p.date)}
                        className={[
                          "rounded-xl border-2 px-2 py-2 text-xs transition-all",
                          isSelected
                            ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600",
                        ].join(" ")}
                      >
                        <span className="block font-semibold">{p.label}</span>
                        <span className="text-[10px] opacity-60">
                          {p.date.toLocaleTimeString("es-EC", {
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Custom datetime-local picker · reloj nativo del browser */}
              <div className="mb-3">
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    O elegí hora exacta
                  </span>
                  <div className="relative">
                    <Clock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400"
                      aria-hidden
                    />
                    <input
                      type="datetime-local"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      min={fmtDateTimeLocal(minBound)}
                      max={fmtDateTimeLocal(maxBound)}
                      step={300}
                      className={[
                        "w-full rounded-xl border-2 bg-slate-900 px-3 py-3 pl-10 text-base text-slate-100 transition-colors focus:outline-none",
                        validation.ok || !parsedDate
                          ? "border-slate-700 focus:border-cyan-500"
                          : "border-rose-500 focus:border-rose-400",
                      ].join(" ")}
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                </label>
                {parsedDate && validation.ok ? (
                  <p
                    className="mt-1.5 flex items-center gap-1.5 text-[11px] capitalize"
                    style={{ color: CYAN }}
                  >
                    <Check className="h-3 w-3" />
                    Llega · {fmtPretty(parsedDate)}
                  </p>
                ) : parsedDate && !validation.ok ? (
                  <p className="mt-1.5 text-[11px] text-rose-400">
                    {validation.error}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={!validation.ok}
                style={{
                  background: validation.ok
                    ? `linear-gradient(90deg, ${CYAN} 0%, #2BA8AC 100%)`
                    : "rgba(60,60,60,0.5)",
                  color: validation.ok ? PURPLE : "rgba(255,255,255,0.4)",
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
              >
                <Clock className="h-4 w-4" />
                Reservar horario
              </button>

              <button
                type="button"
                onClick={handleClear}
                className="mt-2 block w-full text-center text-[11px] text-slate-500 underline-offset-2 hover:underline"
              >
                Quitar reserva (pedir ahora mismo)
              </button>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
