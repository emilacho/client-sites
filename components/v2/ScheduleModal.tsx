"use client"
/**
 * ScheduleModal · R97.8.6 · "Reservar para una hora"
 *
 * Cliente elige día + hora · 7 quick presets (30m · 1h · 2h · 3h · 4h · 5h · 6h)
 * + selector día (Hoy / Mañana / Pasado) + reloj nativo time picker en
 * múltiplos de 15 min · sin año en el display (solo ruido visual).
 *
 * Spanish común · no voseo · "elige" en lugar de "elegí" etc.
 *
 * Validación · debe ser futura (+30min) · debe estar dentro horario
 * 11:00-22:00. Persiste en localStorage 'naufrago_schedule_target'.
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

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

function fmtTimeHHMM(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fmtPretty(d: Date): string {
  // Sin año · solo día semana + día mes + hora · español común
  return d.toLocaleString("es-ES", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).replace(/\.\s/g, " ").replace(/\.$/, "")
}

function fmtDayLabel(d: Date): string {
  // "lunes 14 may" · sin año
  return d.toLocaleDateString("es-ES", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).replace(/\.$/, "")
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
      error: `Cocina abierta ${KITCHEN_OPEN_H}:00 - ${KITCHEN_CLOSE_H}:00 · elige otra hora`,
    }
  }
  return { ok: true }
}

export interface ScheduleModalProps {
  open: boolean
  onClose: () => void
}

export function ScheduleModal({ open, onClose }: ScheduleModalProps) {
  // Estado separado · dayDate (00:00:00 del día seleccionado) + timeStr "HH:MM"
  const [dayDate, setDayDate] = useState<Date | null>(null)
  const [timeStr, setTimeStr] = useState<string>("")
  const [success, setSuccess] = useState(false)

  // 7 quick presets · 30m · 1h · 2h · 3h · 4h · 5h · 6h
  const presets = useMemo(() => {
    if (!open) return []
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
      { label: "30 min", date: make(30) },
      { label: "1 hora", date: make(60) },
      { label: "2 horas", date: make(120) },
      { label: "3 horas", date: make(180) },
      { label: "4 horas", date: make(240) },
      { label: "5 horas", date: make(300) },
      { label: "6 horas", date: make(360) },
    ]
  }, [open])

  // 3 day options · Hoy / Mañana / Pasado
  const dayOptions = useMemo(() => {
    if (!open) return []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return [
      { label: "Hoy", date: new Date(today) },
      { label: "Mañana", date: new Date(today.getTime() + 24 * 60 * 60_000) },
      {
        label: "Pasado",
        date: new Date(today.getTime() + 2 * 24 * 60 * 60_000),
      },
    ]
  }, [open])

  useEffect(() => {
    if (!open) return
    setSuccess(false)
    // Pre-fill desde localStorage si existe
    try {
      const stored = window.localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ScheduleTarget
        const d = new Date(parsed.targetIso)
        if (!isNaN(d.getTime()) && d > new Date()) {
          const day = new Date(d)
          day.setHours(0, 0, 0, 0)
          setDayDate(day)
          setTimeStr(fmtTimeHHMM(d))
          return
        }
      }
    } catch {
      // ignore
    }
    // Default · usar preset "1 hora"
    if (presets.length > 0) {
      const pre = presets[1].date
      const day = new Date(pre)
      day.setHours(0, 0, 0, 0)
      setDayDate(day)
      setTimeStr(fmtTimeHHMM(pre))
    }
  }, [open, presets])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  if (!open) return null

  // Build composite date from day + timeStr
  const composite: Date | null = (() => {
    if (!dayDate || !timeStr) return null
    const [h, m] = timeStr.split(":").map((s) => parseInt(s, 10))
    if (isNaN(h) || isNaN(m)) return null
    const d = new Date(dayDate)
    d.setHours(h, m, 0, 0)
    return d
  })()

  const validation = validateTarget(composite)

  function handlePresetClick(date: Date) {
    const day = new Date(date)
    day.setHours(0, 0, 0, 0)
    setDayDate(day)
    setTimeStr(fmtTimeHHMM(date))
  }

  function handleDayClick(date: Date) {
    setDayDate(date)
  }

  function handleTimeChange(value: string) {
    // El input type=time con step=900 ya restringe a múltiplos de 15
    // pero el browser puede dejar pasar otros valores via keyboard ·
    // round forzado por si acaso.
    if (!value) {
      setTimeStr("")
      return
    }
    const [h, m] = value.split(":").map((s) => parseInt(s, 10))
    if (isNaN(h) || isNaN(m)) {
      setTimeStr(value)
      return
    }
    const rounded = Math.round(m / 15) * 15
    const finalM = rounded === 60 ? 0 : rounded
    const finalH = rounded === 60 ? (h + 1) % 24 : h
    setTimeStr(`${pad(finalH)}:${pad(finalM)}`)
  }

  function handleSave() {
    if (!validation.ok || !composite) return
    try {
      const payload: ScheduleTarget = {
        targetIso: composite.toISOString(),
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
    setDayDate(null)
    setTimeStr("")
  }

  // Compare day to dayOptions for selection state
  function isSameDay(a: Date | null, b: Date) {
    if (!a) return false
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    )
  }

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
                ELIGE TU HORA
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Cocina abierta {KITCHEN_OPEN_H}:00 - {KITCHEN_CLOSE_H}:00 ·
                mínimo +{MIN_LEAD_MINUTES} min desde ahora.
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
                {composite ? fmtPretty(composite) : ""}
              </p>
              <p className="text-[11px] text-slate-500">
                Al hacer el pedido vamos a respetar esta hora.
              </p>
            </div>
          ) : (
            <>
              {/* 7 quick presets · pills compactos en flex-wrap */}
              <div className="mb-3">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  Pedir en
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((p) => {
                    const day = new Date(p.date)
                    day.setHours(0, 0, 0, 0)
                    const isSelected =
                      isSameDay(dayDate, day) && timeStr === fmtTimeHHMM(p.date)
                    return (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => handlePresetClick(p.date)}
                        className={[
                          "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                          isSelected
                            ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600",
                        ].join(" ")}
                      >
                        {p.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Day selector · 3 pills */}
              <div className="mb-3">
                <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                  O elige día y hora
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {dayOptions.map((d) => {
                    const isSelected = isSameDay(dayDate, d.date)
                    return (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => handleDayClick(d.date)}
                        className={[
                          "rounded-xl border-2 px-2 py-2 transition-all",
                          isSelected
                            ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                            : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600",
                        ].join(" ")}
                      >
                        <span className="block text-xs font-semibold">
                          {d.label}
                        </span>
                        <span className="block text-[10px] capitalize opacity-60">
                          {fmtDayLabel(d.date)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time input · solo hora · step 15 min */}
              <div className="mb-3">
                <label className="block">
                  <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Hora · múltiplos de 15 min
                  </span>
                  <div className="relative">
                    <Clock
                      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-400"
                      aria-hidden
                    />
                    <input
                      type="time"
                      value={timeStr}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      step={900}
                      min={`${pad(KITCHEN_OPEN_H)}:00`}
                      max={`${pad(KITCHEN_CLOSE_H - 1)}:45`}
                      className={[
                        "w-full rounded-xl border-2 bg-slate-900 px-3 py-3 pl-10 text-base text-slate-100 transition-colors focus:outline-none",
                        validation.ok || !composite
                          ? "border-slate-700 focus:border-cyan-500"
                          : "border-rose-500 focus:border-rose-400",
                      ].join(" ")}
                      style={{ colorScheme: "dark" }}
                    />
                  </div>
                </label>
                {composite && validation.ok ? (
                  <p
                    className="mt-1.5 flex items-center gap-1.5 text-[11px] capitalize"
                    style={{ color: CYAN }}
                  >
                    <Check className="h-3 w-3" />
                    Llega · {fmtPretty(composite)}
                  </p>
                ) : composite && !validation.ok ? (
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
