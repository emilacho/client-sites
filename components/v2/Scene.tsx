"use client"
/**
 * Scene · the Náufrago landing v2 r3f scene.
 *
 * Mounts:
 *  - island base GLB
 *  - character GLB · anchored with hover-listening group · drei <Html>
 *    speech bubble above its head
 *  - 4 interactive anchor groups (cofre · barco · cocos · palmeras) ·
 *    each pulses + opens its respective overlay panel via the parent
 *  - CameraRig (auto-rotate + hover-pause + drag-cede + reduced-motion)
 *  - postprocessing bloom (subtle · only on the cyan-emissive interactives)
 *
 * The GLBs ship the actual geometry: island contains the chest (cofre),
 * boat (barco), coconuts (cocos), and palms (palmeras) baked in as
 * named meshes. We DON'T re-attach them to a different transform · we
 * place INVISIBLE proxy groups at the world positions of those baked
 * meshes and use them as interaction surfaces + bubble anchors. This
 * keeps the visual identical to the GLB ground truth.
 */
import { Suspense, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Environment,
  Html,
  PerformanceMonitor,
  useGLTF,
  ContactShadows,
} from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import * as THREE from "three"

import { CameraRig } from "./CameraRig"
import { SpeechBubble } from "./SpeechBubble"
import {
  useInteractiveIdlePulse,
  usePrefersReducedMotion,
} from "@/lib/v2/use-interactive-idle-pulse"
import { naufragoAssets } from "@/lib/v2/naufrago-content"

// Preload the 4 GLBs at module load so the first paint of the canvas
// doesn't kick off a 4-network-roundtrip waterfall.
useGLTF.preload(naufragoAssets.island)
useGLTF.preload(naufragoAssets.character)
useGLTF.preload(naufragoAssets.sign)
useGLTF.preload(naufragoAssets.surfboard)

export type AnchorKind = "cofre" | "barco" | "cocos" | "palmeras"

interface SceneProps {
  onAnchorClick: (anchor: AnchorKind) => void
}

/**
 * Approximate world-space positions for the 4 interaction anchors on
 * the island GLB. The GLB has these meshes baked in · the proxy groups
 * land approximately where they sit so hover hit-detection feels right.
 * Coordinates were eyeballed from the island bbox; fine-tuning happens
 * in design review · acceptable visual placement is the bar.
 */
const ANCHOR_POSITIONS: Record<AnchorKind, [number, number, number]> = {
  cofre:    [ 1.4, 0.55, 0.9 ],  // chest sits on the beach front-right
  barco:    [-2.4, 0.30, 1.2 ],  // surfboard / boat to the left
  cocos:    [ 0.4, 1.40, -1.5 ], // coconuts hang on the central palm
  palmeras: [-1.6, 1.30, -1.8 ], // back-left palm cluster
}

const ANCHOR_LABELS: Record<AnchorKind, string> = {
  cofre: "Carrito",
  barco: "Historia",
  cocos: "Reseñas",
  palmeras: "Contacto",
}

export function Scene({ onAnchorClick }: SceneProps) {
  const reducedMotion = usePrefersReducedMotion()
  const [hoveredAnchor, setHoveredAnchor] = useState<AnchorKind | null>(null)
  return (
    <Canvas
      shadows
      camera={{ position: [9, 4, 0], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
    >
      <color attach="background" args={["#06080f"]} />
      <fog attach="fog" args={["#06080f", 12, 28]} />

      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 5, -3]} intensity={0.35} color="#06b6d4" />

      <CameraRig pausedHover={hoveredAnchor !== null} reducedMotion={reducedMotion} />

      <Suspense fallback={null}>
        <PerformanceMonitor onDecline={() => { /* fallback handled via dpr already */ }}>
          <IslandWithCharacter />
          {/* Sign + surfboard placed near the beach front · purely visual */}
          <SignModel position={[2.4, 0.0, -0.4]} rotation={[0, -0.5, 0]} />
          <SurfboardModel position={[-3.0, 0.05, 0.3]} rotation={[0, 0.7, 0.2]} scale={0.7} />

          {(Object.keys(ANCHOR_POSITIONS) as AnchorKind[]).map((kind, idx) => (
            <InteractiveAnchor
              key={kind}
              kind={kind}
              index={idx}
              position={ANCHOR_POSITIONS[kind]}
              label={ANCHOR_LABELS[kind]}
              hovered={hoveredAnchor === kind}
              reducedMotion={reducedMotion}
              onHover={(h) => setHoveredAnchor(h ? kind : (prev) => (prev === kind ? null : prev as AnchorKind))}
              onClick={() => onAnchorClick(kind)}
            />
          ))}
        </PerformanceMonitor>

        <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={14} blur={2.4} far={3.5} />
        <Environment preset="sunset" />
      </Suspense>

      <EffectComposer>
        <Bloom
          intensity={0.6}
          luminanceThreshold={0.35}
          luminanceSmoothing={0.5}
          mipmapBlur
        />
      </EffectComposer>
    </Canvas>
  )
}

// ── GLB renderers ────────────────────────────────────────────────────

function IslandModel(props: React.ComponentProps<"group">) {
  const { scene } = useGLTF(naufragoAssets.island)
  return <primitive object={scene} {...props} />
}

function SignModel(props: React.ComponentProps<"group">) {
  const { scene } = useGLTF(naufragoAssets.sign)
  return <primitive object={scene} {...props} />
}

function SurfboardModel(props: React.ComponentProps<"group">) {
  const { scene } = useGLTF(naufragoAssets.surfboard)
  return <primitive object={scene} {...props} />
}

function CharacterModel(props: React.ComponentProps<"group">) {
  const { scene } = useGLTF(naufragoAssets.character)
  return <primitive object={scene} {...props} />
}

/**
 * IslandWithCharacter · the island base + the castaway character +
 * the character's speech-bubble HTML anchor.
 */
function IslandWithCharacter() {
  const [hovered, setHovered] = useState(false)
  return (
    <group>
      <IslandModel position={[0, 0, 0]} scale={1} />
      <group
        position={[0, 0.05, 0]}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        onPointerDown={() => setHovered((v) => !v)} // mobile tap toggle
      >
        <CharacterModel scale={0.6} position={[-0.1, 0, 0.3]} />
        {/* Speech bubble anchored above the character head · uses drei
            <Html occlude> so it hides behind the geometry properly. */}
        <Html
          position={[-0.1, 2.0, 0.3]}
          center
          distanceFactor={6}
          occlude
          zIndexRange={[10, 0]}
          style={{ pointerEvents: "none" }}
        >
          <SpeechBubble visible={hovered} mobileAuto onAutoHide={() => setHovered(false)} />
        </Html>
      </group>
    </group>
  )
}

// ── Interactive anchor with pulsing scale + cyan emissive + drei Html label ──
interface InteractiveAnchorProps {
  kind: AnchorKind
  index: number
  position: [number, number, number]
  label: string
  hovered: boolean
  reducedMotion: boolean
  onHover: (h: boolean) => void
  onClick: () => void
}

function InteractiveAnchor({
  index,
  position,
  label,
  hovered,
  reducedMotion,
  onHover,
  onClick,
}: InteractiveAnchorProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.Mesh>(null)
  const pulse = useInteractiveIdlePulse(index, hovered, reducedMotion)

  useFrame(() => {
    if (groupRef.current) groupRef.current.scale.setScalar(pulse.scale)
    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = pulse.emissiveIntensity
    }
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Invisible interaction sphere · ~0.5m radius · catches pointer events */}
      <mesh
        ref={meshRef}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = "pointer"
          onHover(true)
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto"
          onHover(false)
        }}
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
      >
        <sphereGeometry args={[0.55, 16, 16]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={0.4}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      {/* Floating label above the anchor */}
      <Html
        center
        distanceFactor={8}
        position={[0, 0.9, 0]}
        zIndexRange={[5, 0]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className={[
            "select-none rounded-full border px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.18em]",
            "transition-all duration-200",
            hovered
              ? "border-cyan-300 bg-cyan-500/30 text-cyan-50 shadow-[0_0_18px_-2px_rgba(6,182,212,0.8)]"
              : "border-white/30 bg-black/40 text-cyan-200",
          ].join(" ")}
        >
          {label}
        </div>
      </Html>
    </group>
  )
}
