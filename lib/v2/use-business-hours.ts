"use client"
/**
 * useBusinessHours · R96.13 · evalúa si el local está abierto/cerrado
 * usando hora local del CLIENTE (no del browser · clientes pueden estar
 * en otro timezone). Para Náufrago · America/Guayaquil (UTC-5).
 *
 * Output ·
 *   isOpen · boolean now
 *   closesAt · texto "5pm" si abierto · null si cerrado
 *   opensAt · texto "mañana 9am" · "el jueves 9am" si cerrado
 *
 * Auto-refresh · re-evalúa cada minuto para que el badge no se quede
 * stale cuando cambia el hour.
 */
import { useEffect, useState } from "react"
import { CLIENTE_TZ, cliente, type BusinessHours } from "@/cliente.config"

export interface BusinessHoursState {
  isOpen: boolean
  closesAtText: string | null
  opensAtText: string | null
}

const DAY_NAMES = [
  "domingo",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "sábado",
] as const

function getLocalParts(tz: string): { day: number; hour: number; minute: number } {
  const now = new Date()
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
  const parts = fmt.formatToParts(now)
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Mon"
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0")
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0")
  const dayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  }
  return { day: dayMap[weekday] ?? 0, hour, minute }
}

function fmt12(hour: number): string {
  if (hour === 0) return "12am"
  if (hour === 12) return "12pm"
  if (hour < 12) return `${hour}am`
  return `${hour - 12}pm`
}

function findNextOpen(
  hours: BusinessHours,
  fromDay: number,
): { dayOffset: number; openHour: number } | null {
  for (let i = 1; i <= 7; i++) {
    const d = ((fromDay + i) % 7) as keyof BusinessHours
    const slot = hours[d]
    if (slot) return { dayOffset: i, openHour: slot[0] }
  }
  return null
}

function evaluate(hours: BusinessHours): BusinessHoursState {
  const { day, hour } = getLocalParts(CLIENTE_TZ)
  const slot = hours[day as keyof BusinessHours]

  if (slot) {
    const [open, close] = slot
    if (hour >= open && hour < close) {
      return {
        isOpen: true,
        closesAtText: fmt12(close),
        opensAtText: null,
      }
    }
    // Mismo día pero antes/después de la ventana
    if (hour < open) {
      return {
        isOpen: false,
        closesAtText: null,
        opensAtText: `hoy ${fmt12(open)}`,
      }
    }
  }
  // Cerrado ahora · buscar próxima apertura
  const next = findNextOpen(hours, day)
  if (!next) {
    return { isOpen: false, closesAtText: null, opensAtText: null }
  }
  const dayLabel =
    next.dayOffset === 1
      ? "mañana"
      : next.dayOffset === 2
        ? "pasado mañana"
        : `el ${DAY_NAMES[(day + next.dayOffset) % 7]}`
  return {
    isOpen: false,
    closesAtText: null,
    opensAtText: `${dayLabel} ${fmt12(next.openHour)}`,
  }
}

export function useBusinessHours(): BusinessHoursState {
  const [state, setState] = useState<BusinessHoursState>(() =>
    evaluate(cliente.businessHours),
  )

  useEffect(() => {
    const tick = () => setState(evaluate(cliente.businessHours))
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [])

  return state
}
