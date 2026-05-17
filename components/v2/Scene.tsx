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
  // Round 37 · re-mapped to the real GLB target positions so the
  // invisible proxy spheres actually sit ON the asset the user
  // expects to click. Earlier values were eyeballed against a
  // pre-Round-25 layout and ended up near the wrong meshes.
  //   cofre · was [1.4, 0.55, 0.9] (near SignModel)
  //         → Chest_14 world center post-Round-25
  cofre:    [-0.76, 0.16,  0.18],
  barco:    [-2.4,  0.30,  1.2 ],  // unchanged in this round
  //   cocos · was [0.4, 1.40, -1.5] (between palms, on Tree_Trunk_1_2)
  //         → Coconut_2_5 world position post-Round-25 (central palm fruit)
  cocos:    [ 0.14, 1.36, -0.49],
  palmeras: [-1.6,  1.30, -1.8 ],  // unchanged in this round
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
          {/* Round 33 FINAL · contact Tree_Trunk_2_30 (BACK-LEFT).
              The annotation-pass overlay in Round 33rrr confirmed
              with Emilio that the palm he marked in red is the
              back-left one · NOT the central palm that the Round 33
              REDO had assumed.
              Probe (scripts/probe-trunk-contact.mjs · post-Round-25):
                Tree_Trunk_2_30 center (-1.307, 0.595, -1.976)
                X[-1.448 .. -1.166]  Z[-2.138 .. -1.814]
              Target so surfboard X max edge touches trunk X min:
                X = trunk X min - SURF_X_HALF (0.120) = -1.568
                Z = trunk center Z                    = -1.976
                Y = unchanged at 0.925 (keel on sand top)
              Rotation + scale unchanged. This matches the position
              the ORIGINAL Round 33 commit had; the REDO chase was
              incorrect because the dispatch's "X > -1.5 · Z near 0"
              heuristic didn'\''t match Emilio'\''s actual marker. */}
          <SurfboardModel position={[-1.57, 0.925, -1.98]} rotation={[0, 0.3, Math.PI / 2]} scale={0.7} />

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
  // Round 34 · chest "taladro internal" shake · base rotation captured
  // post-Round-25 (chest dropped 0.4u but rotation unchanged from GLB).
  // The shake adds random rotation jitter for ~0.4s every 3s and snaps
  // back between bursts.
  const chestShakeRef = useRef<{
    obj: THREE.Object3D
    baseRotX: number
    baseRotY: number
    baseRotZ: number
  } | null>(null)
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
    // Round 34 · capture chest base rotation for the taladro shake.
    const chest = scene.getObjectByName("Chest_14")
    if (chest) {
      chestShakeRef.current = {
        obj: chest,
        baseRotX: chest.rotation.x,
        baseRotY: chest.rotation.y,
        baseRotZ: chest.rotation.z,
      }
    }
    // Round 38 · scale up ALL 12 coconuts by 1.2× so the fruit reads
    // bigger and becomes a viable hover target (Round 40 will attach
    // per-coconut review cards). Idempotency via userData.r38Scaled.
    const COCONUT_NAMES = [
      "Coconut_1_3", "Coconut_2_5", "Coconut_3_4",       // central palm
      "Coconut_7_21", "Coconut_8_19", "Coconut_9_20",    // right palm
      "Coconut_4_33", "Coconut_5_32", "Coconut_6_31",    // back-left palm
      "Coconut_10_43", "Coconut_11_44", "Coconut_12_45", // fallen on sand
    ]
    for (const name of COCONUT_NAMES) {
      const c = scene.getObjectByName(name)
      if (c && !c.userData.r38Scaled) {
        c.scale.multiplyScalar(1.2)
        c.userData.r38Scaled = true
      }
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

  // Round 39 · pulse target set retired · coconuts moved to a per-
  // coconut taladro shake (see coconutShakeTargets below). Chest
  // taladro (R34) and boat wave (R31) run independently. The R28
  // material clones for chest/boat/coconuts remain attached but with
  // emissiveIntensity=0 · no visible glow, no further mutation.

  // Round 39 · per-coconut taladro · 4 cocos vibrate at their own
  // random intervals (3s ± 1s) with 0.2s bursts and a random phase
  // offset 0-3s. Math.random() runs ONCE per scene mount (useMemo
  // deps [scene]) · stable across renders, decorrelated between
  // coconuts. Amplitude ±0.02 rad · half the chest shake (R34).
  const coconutShakeTargets = useMemo(() => {
    const names = ["Coconut_1_3", "Coconut_2_5", "Coconut_3_4", "Coconut_10_43"]
    return names
      .map((name) => scene.getObjectByName(name))
      .filter((o): o is THREE.Object3D => Boolean(o))
      .map((obj) => ({
        obj,
        baseRotX: obj.rotation.x,
        baseRotY: obj.rotation.y,
        baseRotZ: obj.rotation.z,
        // Random per-coconut · phase 0-3s, interval 2-4s
        phaseOffset: Math.random() * 3,
        intervalJitter: (Math.random() - 0.5) * 2,
      }))
  }, [scene])

  useFrame((state) => {
    if (inhibited) {
      // Reset · QA screenshot stays pixel-comparable, reduced-motion
      // users get a static scene with no shake, no bobbing.
      for (const w of waveBaseRef.current) {
        w.obj.position.y = w.baseY
        w.obj.rotation.x = w.baseRotX
        w.obj.rotation.z = w.baseRotZ
      }
      const shake = chestShakeRef.current
      if (shake) {
        shake.obj.rotation.x = shake.baseRotX
        shake.obj.rotation.y = shake.baseRotY
        shake.obj.rotation.z = shake.baseRotZ
      }
      for (const c of coconutShakeTargets) {
        c.obj.rotation.x = c.baseRotX
        c.obj.rotation.y = c.baseRotY
        c.obj.rotation.z = c.baseRotZ
      }
      return
    }
    const t = state.clock.elapsedTime

    // ── Round 31 · boat wave bobbing (unchanged)
    const waveY = Math.sin(t * 1.2) * 0.06
    const waveRotZ = Math.sin(t * 0.8) * 0.03
    const waveRotX = Math.cos(t * 1.0) * 0.02
    for (const w of waveBaseRef.current) {
      w.obj.position.y = w.baseY + waveY
      w.obj.rotation.x = w.baseRotX + waveRotX
      w.obj.rotation.z = w.baseRotZ + waveRotZ
    }

    // ── Round 34 · chest "taladro internal" · 0.4s burst every 3s,
    //              still between bursts, ±0.05 rad jitter
    const shake = chestShakeRef.current
    if (shake) {
      const CHEST_INTERVAL = 3.0
      const CHEST_BURST = 0.4
      const CHEST_JITTER = 0.05
      const cyclePos = t % CHEST_INTERVAL
      if (cyclePos < CHEST_BURST) {
        shake.obj.rotation.x = shake.baseRotX + (Math.random() - 0.5) * 2 * CHEST_JITTER
        shake.obj.rotation.y = shake.baseRotY + (Math.random() - 0.5) * 2 * CHEST_JITTER
        shake.obj.rotation.z = shake.baseRotZ + (Math.random() - 0.5) * 2 * CHEST_JITTER
      } else {
        shake.obj.rotation.x = shake.baseRotX
        shake.obj.rotation.y = shake.baseRotY
        shake.obj.rotation.z = shake.baseRotZ
      }
    }

    // ── Round 39.1 · per-coconut taladro · individual intervals
    // (3s ± 1s) · longer 0.9s bursts with a DECAY envelope so the
    // shake starts at peak amplitude 0.02 rad and drops smoothly
    // to 0 over the burst. "Animal pequeño y lento tratando salir"
    // vs the chest's "taladro full power" (uniform 0.05 over 0.4s).
    //   peak amplitude       = 0.02 (40% of chest)
    //   burst duration       = 0.9s (2.25× chest)
    //   amplitude envelope   = peak × (1 − phaseInBurst)²
    //     phaseInBurst = 0   → amp = 0.02   (peak)
    //     phaseInBurst = 0.5 → amp = 0.005  (quartered)
    //     phaseInBurst = 1.0 → amp = 0      (still)
    const COCO_BURST = 0.9
    const COCO_AMP_MAX = 0.02
    for (const c of coconutShakeTargets) {
      const interval = 3 + c.intervalJitter // 2.0–4.0s
      const tAdj = t + c.phaseOffset
      const cyclePos = tAdj % interval
      if (cyclePos < COCO_BURST) {
        const phaseInBurst = cyclePos / COCO_BURST
        const amp = COCO_AMP_MAX * Math.pow(1 - phaseInBurst, 2)
        c.obj.rotation.x = c.baseRotX + (Math.random() - 0.5) * 2 * amp
        c.obj.rotation.y = c.baseRotY + (Math.random() - 0.5) * 2 * amp
        c.obj.rotation.z = c.baseRotZ + (Math.random() - 0.5) * 2 * amp
      } else {
        c.obj.rotation.x = c.baseRotX
        c.obj.rotation.y = c.baseRotY
        c.obj.rotation.z = c.baseRotZ
      }
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

/* IdlePulseRings · removed in Round 39 · cocos moved to per-coconut
 * taladro shake (no rings, no emissive, just internal vibration).
 * Chest taladro (R34) and boat wave bobbing (R31) remain on their
 * own loops inside the IslandModel useFrame.
 */

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
        /* Round 32 · character flotante fix · Y 0.1 → -0.075.
           Round 15/25's compromise Y kept feet between visible
           sand surface (≈-0.075, chest-base reference) and AABB
           top (0.26), which read as "flotando". Landing feet at
           the visible surface (where chest sits) finishes the
           job · character now stands ON sand alongside the chest. */
        position={[0, -0.075, 0]}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
        onPointerDown={() => setHover(!hovered)} // mobile tap toggle
      >
        {/* Round 32 · pull character into the user-marked zone next
            to the chest · X 0 → -0.3 (more negative, closer to chest
            at X=-0.76), Z 0.3 → -0.2 (back from shoreline). */}
        <CharacterModel scale={0.6} position={[-0.3, 0, -0.2]} />
        {/* Speech bubble anchored above the character head · uses drei
            <Html occlude> so it hides behind the geometry properly. */}
        <Html
          /* Round 32 · speech bubble anchor follows the character
             XZ move · stays 2.0u above the head. */
          position={[-0.3, 2.0, -0.2]}
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
