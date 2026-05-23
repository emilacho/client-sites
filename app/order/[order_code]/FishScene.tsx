"use client"
/**
 * FishScene · Round 96.6 · stage "Preparando" del tracker.
 *
 * 3D del pescado (atún · Meshy AI · Draco-compressed) rotando
 * suave + bob vertical · gradient warm de cocina + vapor CSS
 * arriba simulando que se está cocinando. Dynamic-loaded en
 * OrderTracker para que el bundle del tracker no crezca antes
 * de necesitarlo.
 *
 * Identity · CYAN border #4DD4D8 + PURPLE caveat label #3D2466
 * (mismo lenguaje que CanoaScene / CofreScene del tracker).
 */
import { useRef } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import { useGLTF } from "@react-three/drei"
import * as THREE from "three"
import { naufragoAssets } from "@/lib/v2/naufrago-content"

useGLTF.preload(naufragoAssets.atun, true)

const CYAN = "#4DD4D8"
const PURPLE = "#3D2466"
const WARM_TOP = "#FFE9C4"
const WARM_BOTTOM = "#FFB984"

function FishModel() {
  const ref = useRef<THREE.Group>(null)
  const { scene } = useGLTF(naufragoAssets.atun, true)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.6
    ref.current.position.y = Math.sin(performance.now() * 0.002) * 0.08
  })
  return <primitive ref={ref} object={scene} scale={1} />
}

export function FishScene() {
  return (
    <div
      className="my-5 overflow-hidden rounded-2xl"
      style={{
        background: `linear-gradient(180deg, ${WARM_TOP} 0%, ${WARM_BOTTOM} 100%)`,
        height: "240px",
        position: "relative",
        border: `1px solid ${CYAN}55`,
      }}
    >
      {/* Vapor lines · 3 puffs ascendiendo · animación CSS */}
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          className="vapor"
          style={{
            position: "absolute",
            left: `${36 + i * 14}%`,
            bottom: "55%",
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.55)",
            filter: "blur(4px)",
            animation: `vapor-rise 2.8s ease-out ${i * 0.45}s infinite`,
            opacity: 0,
          }}
        />
      ))}

      {/* Canvas r3f con el pescado */}
      <Canvas
        camera={{ position: [0, 0.4, 3.2], fov: 32 }}
        gl={{ antialias: true, alpha: true }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0 }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 5, 4]} intensity={1.4} />
        <directionalLight position={[-2, 2, -3]} intensity={0.4} color="#FFD8A0" />
        <FishModel />
      </Canvas>

      {/* Caveat label · mismo pattern que CanoaScene */}
      <span
        aria-hidden
        className="font-[family-name:var(--font-caveat)]"
        style={{
          position: "absolute",
          bottom: 12,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: "18px",
          color: PURPLE,
          textShadow: "0 1px 2px rgba(255,255,255,0.4)",
        }}
      >
        Cocina trabajando
      </span>

      <style>{`
        @keyframes vapor-rise {
          0%   { transform: translateY(0) scale(1); opacity: 0; }
          25%  { opacity: 0.7; }
          100% { transform: translateY(-80px) scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
