"use client"
/**
 * ScheduleModal · R97.8 · "Reservar para una hora"
 *
 * Cliente elige fecha + hora · pedido programado · zona horaria America/
 * Guayaquil. Persiste la preferencia en localStorage para que cuando
 * confirme el pedido (cart drawer) la hora se respete en el dispatch.
 *
 * Validación · slots disponibles entre 11:00 y 22:00 · cocina cierra 22h ·
 * mínimo +30 min desde ahora (cocina necesita prep time).
 */
import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { X, Clock } from "lucide-react"

const PURPLE = "#3D2466"
const CYAN = "#4DD4D8"
const LS_KEY = "naufrago_schedule_target"

export interface ScheduleModalProps {
  open: boolean
  onClose: () => void
}

interface ScheduleTarget {
  targetIso: string
  storedAt: string
}

function fmtSlot(d: Date): string {
  return d.toLocaleString("es-EC", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

function generateSlots(): Date[] {
  // Slots cada 30 min · próximas 24 horas · entre 11:00 y 22:00
  const now = new Date()
  const minTime = new Date(now.getTime() + 30 * 60_000) // +30min mínimo
  const slots: Date[] = []
  for (let offset = 0; offset < 36; offset++) {
    const slot = new Date(minTime.getTime() + offset * 30 * 60_000)
    const h = slot.getHours()
    if (h >= 11 && h <= 21) {
      slot.setSeconds(0, 0)
      // Round to nearest :00 or :30
      const m = slot.getMinutes()
      slot.setMinutes(m < 15 ? 0 : m < 45 ? 30 : 0)
      if (m >= 45) slot.setHours(slot.getHours() + 1)
      slots.push(new Date(slot))
    }
    if (slots.length >= 12) break
  }
  // Dedup
  return Array.from(new Map(slots.map((s) => [s.toISOString(), s])).values())
}

export function ScheduleModal({ open, onClose }: ScheduleModalProps) {
  const [selectedIso, setSelectedIso] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const slots = open ? generateSlots() : []

  useEffect(() => {
    if (!open) return
    setSuccess(false)
    try {
      const stored = window.localStorage.getItem(LS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ScheduleTarget
        if (parsed.targetIso && new Date(parsed.targetIso) > new Date()) {
          setSelectedIso(parsed.targetIso)
        }
      }
    } catch {
      // ignore
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  function handleSave() {
    if (!selectedIso) return
    try {
      const payload: ScheduleTarget = {
        targetIso: selectedIso,
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
    setSelectedIso(null)
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
                RESERVAR HORA
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                Elegí cuándo querés recibir tu pedido · la cocina arranca
                ~30 min antes.
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
              <Clock className="mx-auto h-8 w-8" style={{ color: CYAN }} />
              <p
                className="font-[family-name:var(--font-bebas),sans-serif] text-xl tracking-wider"
                style={{ color: CYAN }}
              >
                RESERVADO
              </p>
              <p className="text-sm text-slate-300">
                {selectedIso ? fmtSlot(new Date(selectedIso)) : ""}
              </p>
              <p className="text-[11px] text-slate-500">
                Al hacer el pedido · vamos a respetar esta hora.
              </p>
            </div>
          ) : (
            <>
              {selectedIso ? (
                <div
                  className="mb-3 flex items-center justify-between rounded-xl border px-3 py-2"
                  style={{
                    background: "rgba(77,212,216,0.08)",
                    borderColor: "rgba(77,212,216,0.30)",
                  }}
                >
                  <div className="text-xs">
                    <span className="block opacity-60">Reservado actualmente para</span>
                    <span className="font-semibold" style={{ color: CYAN }}>
                      {fmtSlot(new Date(selectedIso))}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-[11px] underline opacity-60 hover:opacity-100"
                  >
                    Quitar
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot) => {
                  const iso = slot.toISOString()
                  const isSelected = iso === selectedIso
                  return (
                    <button
                      key={iso}
                      type="button"
                      onClick={() => setSelectedIso(iso)}
                      className={[
                        "rounded-xl border-2 px-2 py-2 text-xs transition-all",
                        isSelected
                          ? "border-cyan-400 bg-cyan-500/15 text-cyan-100"
                          : "border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-600",
                      ].join(" ")}
                    >
                      <span className="block font-semibold">
                        {slot.toLocaleTimeString("es-EC", {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                      <span className="text-[10px] opacity-60">
                        {slot.toLocaleDateString("es-EC", {
                          weekday: "short",
                          day: "2-digit",
                          month: "short",
                        })}
                      </span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={!selectedIso}
                style={{
                  background: selectedIso
                    ? `linear-gradient(90deg, ${CYAN} 0%, #2BA8AC 100%)`
                    : "rgba(60,60,60,0.5)",
                  color: selectedIso ? PURPLE : "rgba(255,255,255,0.4)",
                }}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
              >
                <Clock className="h-4 w-4" />
                Reservar horario
              </button>

              <p className="mt-2 text-center text-[10px] text-slate-500">
                Horario Olón Ecuador · slots cada 30 min · cocina 11:00-22:00.
              </p>
            </>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
