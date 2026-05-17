"use client"
/**
 * CameraRig · Round 45 floating-drift camera.
 *
 *  - Default position FRONT [0, height, radius] (no more side-view
 *    default · user "siempre de frente")
 *  - NO orbital auto-rotate around Y · isla stays in the same
 *    visual orientation
 *  - Drift offsets layered on top of a base position:
 *      x = sin(t · 0.2) · 0.30   period 31.4s
 *      y = sin(t · 0.4) · 0.25   period 15.7s
 *      z = cos(t · 0.2) · 0.30   period 31.4s
 *    coprime-enough frequencies so the loop never aligns; net motion
 *    reads as a slow elliptical hover.
 *  - Drag-end captures the user'\''s new base position so the drift
 *    continues from where they let go (no snap-reset).
 *  - lookAt ALWAYS (0, 1, 0) · isla center. The drift moves the
 *    camera but never the focal point.
 *  - reducedMotion / pausedHover / qaMode → snap to base, no drift.
 */
import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import type { ComponentRef } from "react"

type OrbitControlsRef = ComponentRef<typeof OrbitControls>

const DRIFT_AMP_X = 0.3
const DRIFT_AMP_Y = 0.25
const DRIFT_AMP_Z = 0.3
const DRIFT_FREQ_X = 0.2
const DRIFT_FREQ_Y = 0.4
const DRIFT_FREQ_Z = 0.2

const LOOKAT_TARGET: [number, number, number] = [0, 1, 0]

export interface CameraRigProps {
  /** True when an anchor proxy is hovered or qaMode is active.
   *  Drift halts and the camera snaps to its base position. */
  pausedHover: boolean
  /** True under prefers-reduced-motion or qaMode. Same effect as
   *  pausedHover · drift halts. Kept as a separate prop so callers
   *  can wire either signal independently. */
  reducedMotion: boolean
  /** Drift center distance from origin. */
  radius?: number
  /** Drift center height. */
  height?: number
  /** Legacy prop · ignored by Round 45. The default position is
   *  always FRONT [0, height, radius] now. */
  initialView?: "side" | "front"
}

export function CameraRig({
  pausedHover,
  reducedMotion,
  radius = 9,
  height = 4,
}: CameraRigProps) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsRef | null>(null)
  const basePositionRef = useRef<THREE.Vector3>(
    new THREE.Vector3(0, height, radius),
  )
  const draggingRef = useRef(false)

  // Initial mount · always FRONT view [0, height, radius]
  useEffect(() => {
    basePositionRef.current.set(0, height, radius)
    camera.position.copy(basePositionRef.current)
    camera.lookAt(...LOOKAT_TARGET)
  }, [camera, radius, height])

  // OrbitControls drag handling
  //   start · suspend drift, let OrbitControls own the camera
  //   end   · capture the camera position as the new drift base
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    const onStart = () => {
      draggingRef.current = true
    }
    const onEnd = () => {
      draggingRef.current = false
      basePositionRef.current.copy(camera.position)
    }
    c.addEventListener("start", onStart)
    c.addEventListener("end", onEnd)
    return () => {
      c.removeEventListener("start", onStart)
      c.removeEventListener("end", onEnd)
    }
  }, [camera])

  useFrame((state) => {
    if (draggingRef.current) {
      // User is dragging · OrbitControls drives position. Just enforce
      // the lookAt so the isla stays the visual anchor.
      camera.lookAt(...LOOKAT_TARGET)
      return
    }
    if (reducedMotion || pausedHover) {
      // Snap to base · no drift, no animation
      camera.position.copy(basePositionRef.current)
      camera.lookAt(...LOOKAT_TARGET)
      return
    }
    const t = state.clock.elapsedTime
    const dx = Math.sin(t * DRIFT_FREQ_X) * DRIFT_AMP_X
    const dy = Math.sin(t * DRIFT_FREQ_Y) * DRIFT_AMP_Y
    const dz = Math.cos(t * DRIFT_FREQ_Z) * DRIFT_AMP_Z
    camera.position.set(
      basePositionRef.current.x + dx,
      basePositionRef.current.y + dy,
      basePositionRef.current.z + dz,
    )
    camera.lookAt(...LOOKAT_TARGET)
  })

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom
      minDistance={radius * 0.8}
      maxDistance={radius * 1.6}
      minPolarAngle={Math.PI / 3.5}
      maxPolarAngle={Math.PI / 2.05}
      makeDefault
    />
  )
}
