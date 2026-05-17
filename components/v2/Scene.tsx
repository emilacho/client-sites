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
          {/* Round 16 placed sign at Y=0.5 · Round 25 island drop -0.4
              brings it to Y=0.1 (same relative gap above sand). */}
          <SignModel position={[0.8, 0.1, 0.5]} rotation={[0, -0.5, 0]} />
          {/* Round 26 · surfboard reposition · user-marked screenshot
              zone (central sand, left of chest, NOT water edge).
                Round 17 pos [-1.0, 0.2, 0.8]  · partially overlapped
                                                 chest X-range +
                                                 sat near shoreline
                Round 26 pos [-1.9, 0.35, -0.2] · 1.14u left of chest
                                                 center (chest at
                                                 X=-0.76), Y bumped to
                                                 sit cleanly above the
                                                 chest-base reference
                                                 Y=0.325, Z pulled back
                                                 to central-back sand
                                                 (clear of Rock_7_47
                                                 at Z=0.45 by 0.07u)
              Bbox X[-2.53..-1.27] Z[-0.78..0.38] inside sand
              X[-2.82..2.75] Z[-3.66..1.57]. No collision with chest,
              character, sign, boat, palms, or remaining rocks.
              Rotation + scale unchanged from Round 17. */}
          {/* Round 30 · surfboard stood up vertical against the
              left-back palm. User marked the zone on a screenshot.
                rotation [0, 0.7, 0.2] (laying flat)
                       → [0, 0.3, Math.PI/2] (vertical · 90° tilt
                         around Z + 17° lean around Y for an angled
                         "propped against palm" silhouette)
                position [-1.9, -0.05, -0.2] (horizontal)
                       → [-1.5, 0.925, -0.7] (probe-confirmed Y)
                scale  0.7 unchanged
              Probe (scripts/probe-surfboard-vertical.mjs):
                Y half-extent post-rotation = 0.665 (board total
                length 1.329u in world Y · the GLB source bbox is
                1.9u × scale 0.7 = 1.33u, NOT 0.931u as Round 17
                math assumed). Required center Y = sand top 0.26 +
                0.665 = 0.925, so keel lands exactly on the sand
                AABB top. Footprint X[-1.62..-1.38] Z[-0.90..-0.50]
                clear of chest, palm trunk, sign, character. */}
          <SurfboardModel position={[-1.5, 0.925, -0.7]} rotation={[0, 0.3, Math.PI / 2]} scale={0.7} />

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
  // Round 31 · ref holds the post-mutation base transforms for the
  // boat + 2 oars · populated at the end of the useEffect below so
  // the wave bobbing in useFrame oscillates around the correct
  // baseline (post Round 22 drop · post Round 25 exempt).
  const waveBaseRef = useRef<
    Array<{ obj: THREE.Object3D; baseY: number; baseRotX: number; baseRotZ: number }>
  >([])
  // Round 13 · Ocean001_57 drop to Y=-0.4 to break shoreline z-fight
  // Round 21 · hide the 4 "shoreline rocks" baked into the GLB at
  //            Z≈1.4-2.1 with Y near 0. The asset designer placed
  //            them to read as "shallow rocky water" against the
  //            original Y=0 ocean. After Round 13 dropped the ocean
  //            to Y=-0.4, those 4 rocks now stand 0.35u above the
  //            water with no sand beneath = "piedras flotando".
  //            Solid 6-rock cluster on sand stays intact.
  useEffect(() => {
    const ocean = scene.getObjectByName("Ocean001_57")
    if (ocean && ocean.position.y === 0) {
      ocean.position.y = -0.4
    }
    for (const name of ["Rock_1_51", "Rock_2_54", "Rock_3_55", "Rock_4_52"]) {
      const r = scene.getObjectByName(name)
      if (r) r.visible = false
    }
    // Round 22 · lower boat + its 2 oars by 0.36u so the keel reaches
    // the new water plane (Y=-0.4). Same disease as the rocks · the
    // boat was designed for a Y=0 ocean. Oar_1_16 and Oar_2_17 are
    // GLB scene-tree siblings of Boat_15 (not children) so they need
    // explicit motion to keep the boat-and-oars assembly coherent.
    // Guard with `position.y > -0.3` so HMR / strict-mode re-runs
    // don't double-apply the delta.
    const BOAT_DELTA_Y = -0.36
    for (const name of ["Boat_15", "Oar_1_16", "Oar_2_17"]) {
      const obj = scene.getObjectByName(name)
      if (obj && obj.position.y > -0.3) {
        obj.position.y += BOAT_DELTA_Y
      }
    }
    // Round 25 · drop the entire island assembly (sand + palms + chest
    // + rocks + coconuts + Island537 grass cap) by 0.4u so the sand
    // bottom dips below the water plane at Y=-0.4. Eliminates the
    // 0.04u "isla flotante" airgap between sand bottom (Y=-0.36) and
    // water. After this drop · sand Y[-0.76 .. +0.26], coast reads as
    // emerging naturally from the water.
    //   exempt · Ocean001_57 (the water itself · stays at -0.4)
    //          · Cube_59     (skybox · far above scene, no effect)
    //          · Boat_15 + Oar_1_16 + Oar_2_17 (sit in water · keel
    //            already at water level per Round 22)
    // The external CharacterModel, SignModel, SurfboardModel JSX props
    // are also lowered by 0.4u (see below) to maintain their relative
    // height above the new sand surface.
    const islandRoot = scene.getObjectByName("GLTF_SceneRootNode") ?? scene
    const ROUND_25_EXEMPT = new Set([
      "Ocean001_57",
      "Cube_59",
      "Boat_15",
      "Oar_1_16",
      "Oar_2_17",
    ])
    for (const child of islandRoot.children) {
      if (!ROUND_25_EXEMPT.has(child.name) && !child.userData.r25Lowered) {
        child.position.y -= 0.4
        child.userData.r25Lowered = true
      }
    }
    // Round 31 · capture base transforms for boat + 2 oars AFTER all
    // position mutations above (R22 lower, R21 visibility, R25
    // exempt) so the wave bobbing in useFrame below oscillates around
    // the correct baseline. Stored in a ref because useMemo would
    // run before useEffect and miss the post-mutation values.
    const waveSeed = [
      scene.getObjectByName("Boat_15"),
      scene.getObjectByName("Oar_1_16"),
      scene.getObjectByName("Oar_2_17"),
    ].filter((o): o is THREE.Object3D => Boolean(o))
    waveBaseRef.current = waveSeed.map((obj) => ({
      obj,
      baseY: obj.position.y,
      baseRotX: obj.rotation.x,
      baseRotZ: obj.rotation.z,
    }))
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

  // Round 28 · capture mesh refs + clone materials per target so we
  // can pulse emissive cyan without leaking onto other meshes that
  // share the same material instance in the GLB. Materials are
  // cloned exactly once per mount (userData.r28Cloned guard).
  const pulseTargets = useMemo(() => {
    const get = (name: string) => scene.getObjectByName(name)
    const list = [
      get("Chest_14"),
      get("Boat_15"),
      get("Coconut_10_43"),
      get("Tree_Trunk_1_2"),
    ].filter((o): o is THREE.Object3D => Boolean(o))
    return list.map((obj) => {
      const meshes: THREE.Mesh[] = []
      obj.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh
          if (!mesh.userData.r28Cloned && mesh.material) {
            const oldMat = mesh.material as THREE.MeshStandardMaterial
            const cloned = oldMat.clone()
            cloned.emissive = new THREE.Color("#4DD4D8")
            cloned.emissiveIntensity = 0
            mesh.material = cloned
            mesh.userData.r28Cloned = true
          }
          meshes.push(mesh)
        }
      })
      return { obj, baseScale: obj.scale.x, meshes }
    })
  }, [scene])

  useFrame((state) => {
    if (inhibited) {
      // Reset · QA screenshot must stay pixel-comparable, reduced-
      // motion users get a static scene with no glow leakage and no
      // bobbing motion.
      for (const { obj, baseScale, meshes } of pulseTargets) {
        obj.scale.setScalar(baseScale)
        for (const mesh of meshes) {
          const mat = mesh.material as THREE.MeshStandardMaterial
          if (mat && "emissiveIntensity" in mat) mat.emissiveIntensity = 0
        }
      }
      for (const w of waveBaseRef.current) {
        w.obj.position.y = w.baseY
        w.obj.rotation.x = w.baseRotX
        w.obj.rotation.z = w.baseRotZ
      }
      return
    }
    const t = state.clock.elapsedTime
    // ── Round 18/23/28 · idle pulse on the 4 interactive GLB groups
    const DURATION = 3.5
    const STAGGER = 0.8
    const AMPLITUDE = 0.09
    const EMISSIVE_MAX = 0.5
    for (let i = 0; i < pulseTargets.length; i++) {
      const { obj, baseScale, meshes } = pulseTargets[i]
      const phase = ((t + i * STAGGER) % DURATION) / DURATION // 0..1
      const tri = 1 - Math.abs(2 * phase - 1)                 // 0..1..0
      const eased = tri * tri * (3 - 2 * tri)                 // smoothstep
      obj.scale.setScalar(baseScale * (1 + AMPLITUDE * eased))
      const ei = EMISSIVE_MAX * eased
      for (const mesh of meshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (mat && "emissiveIntensity" in mat) mat.emissiveIntensity = ei
      }
    }
    // ── Round 31 · boat wave bobbing · 3 different frequencies so
    // the loop never reads as repetitive · subtle (max ~6cm bob,
    // ±1.7° roll, ±1.1° pitch) but enough to break the static feel.
    // Boat scale is independent (Round 28 pulse) and runs on its own.
    const waveY = Math.sin(t * 1.2) * 0.06
    const waveRotZ = Math.sin(t * 0.8) * 0.03
    const waveRotX = Math.cos(t * 1.0) * 0.02
    for (const w of waveBaseRef.current) {
      w.obj.position.y = w.baseY + waveY
      w.obj.rotation.x = w.baseRotX + waveRotX
      w.obj.rotation.z = w.baseRotZ + waveRotZ
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
 * IdlePulseRings · 4 flat cyan rings sitting under the interactive
 * GLB targets (Round 28). Opacity pulses in sync with the GLB scale
 * pulse · same 3.5s/0.8s smoothstep curve. Reads as a "click here"
 * floor halo without modifying any GLB geometry.
 *
 * Coordinates account for the Round 25 island drop (-0.4 on
 * Chest/Coconut/Tree_Trunk) and the boat being exempt (still in
 * water at the Round 22 Y level).
 */
function IdlePulseRings() {
  const reducedMotion = usePrefersReducedMotion()
  const qaMode = useQaMode()
  const inhibited = reducedMotion || qaMode
  const refs = useRef<(THREE.Mesh | null)[]>([])

  const rings = useMemo(
    () => [
      // cofre · world X/Z = (-0.76, 0.18) post-Round-25 (chest dropped)
      { pos: [-0.76, -0.05, 0.18] as [number, number, number], radius: 0.55 },
      // barco · world X/Z = (1.31, 1.87), Y at water level (Round 22 boat exempt)
      { pos: [1.31, -0.39, 1.87] as [number, number, number], radius: 0.85 },
      // cocos · fallen coconut on sand
      { pos: [0.24, -0.05, -0.26] as [number, number, number], radius: 0.3 },
      // palmera central · trunk base
      { pos: [0.07, -0.05, -0.42] as [number, number, number], radius: 0.55 },
    ],
    [],
  )

  useFrame((state) => {
    if (inhibited) {
      for (const mesh of refs.current) {
        if (mesh) (mesh.material as THREE.MeshBasicMaterial).opacity = 0
      }
      return
    }
    const t = state.clock.elapsedTime
    const DURATION = 3.5
    const STAGGER = 0.8
    const OPACITY_MIN = 0.2
    const OPACITY_MAX = 0.75
    for (let i = 0; i < refs.current.length; i++) {
      const mesh = refs.current[i]
      if (!mesh) continue
      const phase = ((t + i * STAGGER) % DURATION) / DURATION
      const tri = 1 - Math.abs(2 * phase - 1)
      const eased = tri * tri * (3 - 2 * tri)
      const op = OPACITY_MIN + (OPACITY_MAX - OPACITY_MIN) * eased
      ;(mesh.material as THREE.MeshBasicMaterial).opacity = op
    }
  })

  return (
    <group>
      {rings.map((r, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          position={r.pos}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[r.radius * 0.78, r.radius, 48]} />
          <meshBasicMaterial
            color="#4DD4D8"
            transparent
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      ))}
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
      <IdlePulseRings />
      <group
        /* Round 15 set character outer group Y=0.5 (feet sit on sand
           above visible surface). Round 25 dropped the whole island
           by 0.4u so the character needs to drop with it · Y=0.5 →
           Y=0.1. Same relative offset above the new sand surface. */
        position={[0, 0.1, 0]}
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
