"use client"
/**
 * CameraRig · cinematic auto-rotate camera + hover-pause + drag-cede.
 *
 *  - rotates 6°/s around the scene origin (60s per full revolution)
 *  - pauses when ANY interactive anchor is hovered (controlled by
 *    the parent scene via the `pausedHover` prop)
 *  - drag manual cede control (OrbitControls handles drag events; the
 *    rig listens to `start` / `end` and re-arms a 2000ms idle timer
 *    on `end`)
 *  - honors `prefers-reduced-motion` (no rotation, only static target)
 *  - all clamped to a horizontal orbit · vertical bound to keep the
 *    island and character readable
 */
import { useEffect, useRef } from "react"
import { useFrame, useThree } from "@react-three/fiber"
import { OrbitControls } from "@react-three/drei"
import * as THREE from "three"
import type { ComponentRef } from "react"

type OrbitControlsRef = ComponentRef<typeof OrbitControls>

const DEGREES_PER_SECOND = 6 // 60s / full revolution
const RESUME_DELAY_MS = 2000

export interface CameraRigProps {
  /** When true, auto-rotation halts (typically because an anchor is hovered). */
  pausedHover: boolean
  /** When true, all motion is suppressed (used for prefers-reduced-motion). */
  reducedMotion: boolean
  /** Orbit radius from the scene origin. */
  radius?: number
  /** Initial Y offset (height of the camera). */
  height?: number
}

export function CameraRig({
  pausedHover,
  reducedMotion,
  radius = 9,
  height = 4,
}: CameraRigProps) {
  const { camera } = useThree()
  const controlsRef = useRef<OrbitControlsRef | null>(null)
  const angleRef = useRef(0) // current azimuth in radians
  const userControlUntilRef = useRef<number>(0) // timestamp · auto-rotate suspended until this ms

  // Initialize camera position on mount
  useEffect(() => {
    camera.position.set(radius, height, 0)
    camera.lookAt(0, 1.2, 0)
  }, [camera, radius, height])

  // Listen to OrbitControls drag events · suspend auto-rotate for
  // RESUME_DELAY_MS after the user releases.
  useEffect(() => {
    const c = controlsRef.current
    if (!c) return
    const onStart = () => {
      userControlUntilRef.current = Number.POSITIVE_INFINITY
    }
    const onEnd = () => {
      userControlUntilRef.current = performance.now() + RESUME_DELAY_MS
      // Re-sync our internal angle with where the user dragged to.
      const v = new THREE.Vector3()
      camera.getWorldPosition(v)
      angleRef.current = Math.atan2(v.z, v.x)
    }
    c.addEventListener("start", onStart)
    c.addEventListener("end", onEnd)
    return () => {
      c.removeEventListener("start", onStart)
      c.removeEventListener("end", onEnd)
    }
  }, [camera])

  useFrame((_, delta) => {
    if (reducedMotion) return
    if (pausedHover) return
    if (performance.now() < userControlUntilRef.current) return

    angleRef.current += THREE.MathUtils.degToRad(DEGREES_PER_SECOND) * delta
    const a = angleRef.current
    camera.position.x = Math.cos(a) * radius
    camera.position.z = Math.sin(a) * radius
    camera.position.y = height
    camera.lookAt(0, 1.2, 0)
    controlsRef.current?.update()
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
