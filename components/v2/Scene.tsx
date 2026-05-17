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
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Environment,
  Html,
  PerformanceMonitor,
  useAnimations,
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
import { useQaMode } from "@/lib/v2/use-qa-mode"
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

// ANCHOR_LABELS removed in round-3 single-issue fix · the 4 drei <Html>
// floating pill labels ("Carrito" / "Historia" / "Reseñas" / "Contacto")
// were the only consumers of this map and have been deleted (per spec
// "Interactive object idle pulse" · interactivity hint is now only the
// idle pulse + cyan emissive glow).

export function Scene({ onAnchorClick }: SceneProps) {
  const reducedMotion = usePrefersReducedMotion()
  // QA toggle · when `?qa=1` is set, freeze the camera + suppress idle
  // pulse + suppress the character speech bubble so screenshots are
  // pixel-comparable across deploys. Treated as a stronger reduced-
  // motion · combined into one flag so downstream consumers don't have
  // to know about both.
  const qaMode = useQaMode()
  const motionInhibited = reducedMotion || qaMode
  const [hoveredAnchor, setHoveredAnchor] = useState<AnchorKind | null>(null)
  return (
    <Canvas
      shadows
      camera={{ position: [9, 4, 0], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      dpr={[1, 2]}
    >
      {/* Round 11 single-issue fix · removed
          `<color attach="background" args={["#06080f"]} />`
          `<fog   attach="fog"        args={["#06080f", 12, 28]} />`
          The island GLB ships its own skybox (`Cube_59` · emissive
          MeshPhysicalMaterial with embedded sky texture) and an ocean
          plane (`Ocean001_57` · #2170ff). The previous fog faded both
          to #06080f at distance > 28u because the skybox lives ~30u
          out from the origin · GLB sky never rendered. Removing the
          two lines lets the asset's native sky + ocean show through.
          Environment preset="sunset" kept · only used for PBR refl. */}

      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 8, 3]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-4, 5, -3]} intensity={0.35} color="#06b6d4" />

      {/* When qaMode is on we force pausedHover=true so the auto-rotate
          frame never runs · the camera stays at its initial fixed angle
          for the entire session. Round 8.5 · QA captures use the
          front view [0, 4, 9] instead of the side view [9, 4, 0] so
          the character, chest, sign and surfboard all read clearly in
          a single frame. Default UX (no qaMode) keeps the side view
          to match v1 behavior on user-facing loads. */}
      <CameraRig
        pausedHover={hoveredAnchor !== null || qaMode}
        reducedMotion={motionInhibited}
        initialView={qaMode ? "front" : "side"}
      />

      <Suspense fallback={null}>
        <PerformanceMonitor onDecline={() => { /* fallback handled via dpr already */ }}>
          <IslandWithCharacter qaMode={qaMode} />
          {/* Sign + surfboard placed near the beach front · purely visual */}
          {/* Round 7 single-issue fix · sign + surfboard moved onto
              Island_0 sand (world bbox X[-2.82..2.75], Z[-3.66..1.57]).
              Old positions [2.4, 0, -0.4] + [-3.0, 0.05, 0.3] put each
              GLB's extent partly outside the sand · sign right half +
              surfboard most-of-body floated in water. New coords keep
              both inside the sand by margin:
                sign      → X[0.37..2.03] · Z[-1.5..-0.5]
                surfboard → X[-1.90..-0.90] · Z[0.40..0.80]
              No rotation / scale change · just position. */}
          {/* Round 16 single-issue fix · sign moved [1.2, 0, -1.0] →
              [0.8, 0.5, 0.5]. Y lifted from 0 to 0.5 (matches character
              lift Round 15) · Y=0 buried the sign in sand (GLB bbox
              Y[-0.225..+0.225], visible sand surface ~Y=0.12-0.33 ·
              only the top 22mm was visible). XZ shifted from back-
              right (Z=-1.0) to front-center (Z=0.5, X=0.8) so the
              sign reads from the default-cam initial side-view AND
              the +Z front view (2/4 angles confirmed visible · was
              1/4 visible borderline). Rotation unchanged. */}
          <SignModel position={[0.8, 0.5, 0.5]} rotation={[0, -0.5, 0]} />
          {/* Round 17 single-issue fix · surfboard moved
              [-1.4, 0.05, 0.6] → [-1.0, 0.2, 0.8]. Same buried
              disease as sign Round 16 · surfboard GLB pivot at
              bbox center (Y range [-0.07..+0.07] after scale 0.7),
              previous Y=0.05 placed surfboard top at Y=0.12 · just
              at the low end of visible sand surface · effectively
              submerged. Y=0.2 puts bottom at Y=0.13 (just above
              sand) so it reads as resting on the beach (kept LOW ·
              surfboards lie down, unlike sign/character which stand).
              XZ tweak (X -1.4→-1.0, Z 0.6→0.8) pulls it slightly
              center + forward to balance the sign on the right
              and increase visibility from default cam. */}
          <SurfboardModel position={[-1.0, 0.2, 0.8]} rotation={[0, 0.7, 0.2]} scale={0.7} />

          {(Object.keys(ANCHOR_POSITIONS) as AnchorKind[]).map((kind, idx) => (
            <InteractiveAnchor
              key={kind}
              kind={kind}
              index={idx}
              position={ANCHOR_POSITIONS[kind]}
              hovered={hoveredAnchor === kind}
              reducedMotion={motionInhibited}
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
  // Round 13 · Ocean001_57 drop to Y=-0.4 to break shoreline z-fight
  useEffect(() => {
    const ocean = scene.getObjectByName("Ocean001_57")
    if (ocean && ocean.position.y === 0) {
      ocean.position.y = -0.4
    }
  }, [scene])

  // Round 18 single-issue fix · idle pulse on visible GLB sub-groups
  // (Round 6 made the proxy spheres opacity-0, so the existing
  // useInteractiveIdlePulse signal was being painted into an
  // invisible mesh). Pulse the actual GLB groups that the four
  // anchors map to:
  //   cofre    → Chest_14
  //   barco    → Boat_15
  //   cocos    → Coconut_10_43 (fallen coconut on sand · most visible)
  //   palmeras → Tree_Trunk_1_2 (central palm trunk)
  // Pulse curve · scale baseline × (1 + 0.03 × smoothstep(triangle))
  // over duration 3.5s, stagger 0.8s per index. Inhibited by
  // prefers-reduced-motion and the ?qa=1 query toggle so the QA
  // screenshot suite stays pixel-comparable.
  const reducedMotion = usePrefersReducedMotion()
  const qaMode = useQaMode()
  const inhibited = reducedMotion || qaMode

  const pulseTargets = useMemo(() => {
    const get = (name: string) => scene.getObjectByName(name)
    const list = [
      get("Chest_14"),
      get("Boat_15"),
      get("Coconut_10_43"),
      get("Tree_Trunk_1_2"),
    ].filter((o): o is THREE.Object3D => Boolean(o))
    return list.map((obj) => ({ obj, baseScale: obj.scale.x }))
  }, [scene])

  useFrame((state) => {
    if (inhibited) {
      // Reset to baseline so the QA screenshot is identical to the
      // pre-pulse layout and reduced-motion users see no drift.
      for (const { obj, baseScale } of pulseTargets) {
        obj.scale.setScalar(baseScale)
      }
      return
    }
    const t = state.clock.elapsedTime
    const DURATION = 3.5
    const STAGGER = 0.8
    const AMPLITUDE = 0.03
    for (let i = 0; i < pulseTargets.length; i++) {
      const { obj, baseScale } = pulseTargets[i]
      const phase = ((t + i * STAGGER) % DURATION) / DURATION // 0..1
      const tri = 1 - Math.abs(2 * phase - 1)                 // 0..1..0
      const eased = tri * tri * (3 - 2 * tri)                 // smoothstep
      obj.scale.setScalar(baseScale * (1 + AMPLITUDE * eased))
    }
  })

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
  // Round 8 single-issue fix · attach the GLB's embedded animation
  // (Armature|Confused_Scratch|baselayer · 11.53 s · 72 tracks · pinned
  // via scripts/inspect-glbs.mjs) on infinite seamless loop. The clip
  // plays unconditionally at mount · no trigger needed.
  //
  // NOTE: do NOT `scene.clone(true)` here · the GLB ships SkinnedMesh
  // nodes whose internal bone references point at the ORIGINAL
  // armature. THREE.Object3D.clone() does not rebind SkinnedMesh →
  // Bone references, so a cloned scene appears in T-pose while the
  // mixer animates the unrendered original. Canonical drei pattern is
  // to mount the original scene · since this character is rendered
  // exactly once on the landing, there's nothing to clone for.
  const { scene, animations } = useGLTF(naufragoAssets.character)
  const group = useRef<THREE.Group>(null)
  const { actions, mixer } = useAnimations(animations, group)
  useEffect(() => {
    const firstKey = Object.keys(actions)[0]
    if (!firstKey) return
    const action = actions[firstKey]
    if (!action) return
    action.reset()
    action.setLoop(THREE.LoopRepeat, Infinity)
    action.clampWhenFinished = false
    action.play()
    return () => {
      mixer?.stopAllAction()
    }
  }, [actions, mixer])
  return (
    <group ref={group} {...props}>
      <primitive object={scene} />
    </group>
  )
}

/**
 * IslandWithCharacter · the island base + the castaway character +
 * the character's speech-bubble HTML anchor.
 *
 * When `qaMode` is true · the speech bubble stays hidden regardless
 * of pointer state so QA screenshot captures don't show a bubble that
 * may have fired from a stray pointer event.
 */
function IslandWithCharacter({ qaMode }: { qaMode: boolean }) {
  const [hovered, setHovered] = useState(false)
  const setHover = (v: boolean) => {
    if (qaMode) return
    setHovered(v)
  }
  return (
    <group>
      <IslandModel position={[0, 0, 0]} scale={1} />
      <group
        /* Round 15 single-issue fix · character outer group Y bumped
           from 0.05 → 0.5. Forensic (scripts/probe-character.mjs):
           character GLB local feet sits at Y=0, scaled by 0.6 →
           world-space feet were landing at Y=0.05 · 0.07–0.27u below
           the visible sand surface (tree trunks parented at Y≈0.12 ·
           chest base at Y=0.325) · this read as "hundido hasta las
           rodillas". Y=0.5 puts feet just above chest-base level and
           below sand-AABB top (0.66) · character stands on sand. */
        position={[0, 0.5, 0]}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onPointerDown={() => setHover(!hovered)} // mobile tap toggle
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
          <SpeechBubble visible={hovered && !qaMode} mobileAuto onAutoHide={() => setHover(false)} />
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
  // `label` prop was removed in round-3 single-issue fix (no longer
  // any consumer · the drei <Html> floating pill is gone).
  hovered: boolean
  reducedMotion: boolean
  onHover: (h: boolean) => void
  onClick: () => void
}

function InteractiveAnchor({
  index,
  position,
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
        {/* Round 6 single-issue fix · the proxy sphere is now fully
            invisible (meshBasicMaterial · opacity 0 · depthWrite off).
            Raycast still hits the geometry so pointer/click events
            continue to fire · only the visual chrome is gone. The
            idle-pulse hook upstream still runs (it mutates
            emissiveIntensity which MeshBasicMaterial silently ignores
            · cost is one extra property write per frame · cheaper than
            restructuring the hook). */}
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Floating drei <Html> label was removed in round-3 single-issue
          fix · per spec "Interactive object idle pulse" · interactivity
          is hinted ONLY through the idle pulse + cyan glow (the
          translucent sphere above + emissive intensity oscillation).
          NO other change in this commit · proxy sphere, anchor
          positions, water, sky, fog, tone mapping, bloom and all other
          scene config remain exactly as in 462ec3f. */}
    </group>
  )
}
