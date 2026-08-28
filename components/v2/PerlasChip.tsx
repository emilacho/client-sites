"use client"
/**
 * Chip del tesoro de naufrago en la barra superior, con conteo animado.
 * R121 - muestra DOLARES, no unidades: antes decia '340' y el cliente
 * tenia que convertir mentalmente para saber que eran $3.40.
 * Framer-motion useMotionValue + animate() · transición suave entre
 * deltas de balance (ej. 100 → 240 al confirmar DELIVERED).
 */
import { tesoroUsd } from "@/lib/perlas"
import { useEffect, useRef, useState } from "react"
import { animate } from "framer-motion"

interface Props {
  value: number
  onClick?: () => void
}

export default function PerlasChip({ value, onClick }: Props) {
  const [display, setDisplay] = useState(value)
  const prevRef = useRef(value)

  useEffect(() => {
    const from = prevRef.current
    const to = value
    if (from === to) return
    const controls = animate(from, to, {
      duration: Math.min(2.0, Math.max(0.4, Math.abs(to - from) / 60)),
      ease: [0.22, 0.61, 0.36, 1],
      onUpdate: (latest) => {
        setDisplay(Math.round(latest))
      },
      onComplete: () => {
        setDisplay(to)
        prevRef.current = to
      },
    })
    return () => controls.stop()
  }, [value])

  // R96.128 · siempre visible cuando hay sesión · incluso con el tesoro en cero ·
  // así el cliente nuevo (logueado pero sin pedidos) ve la feature loyalty
  // existe · le motiva a hacer el primer pedido. Pre-R96.128 ocultaba si <=0.

  return (
    <button
      type="button"
      onClick={onClick}
      className="mr-2 inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold text-cyan-100 transition-colors hover:bg-cyan-500/20"
      title={`Tu tesoro de náufrago · $${tesoroUsd(value)}`}
    >
      <span aria-hidden>✦</span>
      <span className="tabular-nums">${tesoroUsd(display)}</span>
    </button>
  )
}
