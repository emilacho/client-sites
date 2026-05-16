"use client"
/**
 * useInteractiveIdlePulse · shared breathing-clock for the 4 interactive
 * anchor objects on the Náufrago landing v2 scene.
 *
 *  - scale  1.0 ↔ 1.02 · period 3.5s · sin curve
 *  - cyan emissive intensity 0.4 ↔ 0.7 · same period
 *  - stagger 0.8s per anchor index
 *  - cancels when the anchor is hovered (caller passes `paused`)
 *  - returns no-op values when `prefers-reduced-motion: reduce` is set
 *
 * Pure hook · runs in r3f's render loop · no React state allocations.
 */
import { useEffect, useRef, useState } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

const PERIOD_S = 3.5
const STAGGER_S = 0.8
const SCALE_MIN = 1.0
const SCALE_MAX = 1.02
const EMISSIVE_MIN = 0.4
const EMISSIVE_MAX = 0.7
const CYAN = new THREE.Color("#06b6d4")

export interface IdlePulseValues {
  scale: number
  emissive: THREE.Color
  emissiveIntensity: number
}

export function useInteractiveIdlePulse(
  anchorIndex: number,
  paused: boolean,
  reducedMotion: boolean,
): IdlePulseValues {
  const valuesRef = useRef<IdlePulseValues>({
    scale: 1,
    emissive: CYAN.clone(),
    emissiveIntensity: 0,
  })

  useFrame(({ clock }) => {
    if (paused || reducedMotion) {
      valuesRef.current.scale = THREE.MathUtils.lerp(valuesRef.current.scale, 1, 0.15)
      valuesRef.current.emissiveIntensity = THREE.MathUtils.lerp(
        valuesRef.current.emissiveIntensity,
        0,
        0.15,
      )
      return
    }
    const t = clock.getElapsedTime() + anchorIndex * STAGGER_S
    const phase = (Math.sin((t / PERIOD_S) * Math.PI * 2) + 1) / 2 // 0..1
    valuesRef.current.scale = THREE.MathUtils.lerp(SCALE_MIN, SCALE_MAX, phase)
    valuesRef.current.emissiveIntensity = THREE.MathUtils.lerp(
      EMISSIVE_MIN,
      EMISSIVE_MAX,
      phase,
    )
  })

  return valuesRef.current
}

/**
 * usePrefersReducedMotion · SSR-safe · returns `false` during SSR and
 * the actual user preference after hydration.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(mq.matches)
    const h = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener("change", h)
    return () => mq.removeEventListener("change", h)
  }, [])
  return reduced
}
