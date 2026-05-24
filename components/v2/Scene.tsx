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
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame } from "@react-three/fiber"
import {
  Environment,
  Html,
  PerformanceMonitor,
  Text,
  useAnimations,
  useGLTF,
} from "@react-three/drei"
import { EffectComposer, Bloom } from "@react-three/postprocessing"
import { AnimatePresence, motion } from "framer-motion"
import * as THREE from "three"

import { CameraRig } from "./CameraRig"
import { SpeechBubble } from "./SpeechBubble"
import {
  useInteractiveIdlePulse,
  usePrefersReducedMotion,
} from "@/lib/v2/use-interactive-idle-pulse"
import { useQaMode } from "@/lib/v2/use-qa-mode"
import { naufragoAssets } from "@/lib/v2/naufrago-content"
import { useCart } from "@/lib/v2/cart-context"

// Preload the 5 GLBs at module load so the first paint of the canvas
// doesn't kick off a 5-network-roundtrip waterfall. Round 96 · todos
// los GLBs ahora Draco-compressed · segundo arg `true` activa el
// DRACOLoader (gstatic decoder path) en cada preload.
useGLTF.preload(naufragoAssets.island, true)
useGLTF.preload(naufragoAssets.character, true)
useGLTF.preload(naufragoAssets.sign, true)
useGLTF.preload(naufragoAssets.surfboard, true)
useGLTF.preload(naufragoAssets.cangrejo, true)
useGLTF.preload(naufragoAssets.botella, true)
useGLTF.preload(naufragoAssets.pergamino, true)

// Round 40 · "cocos" removed from anchor kinds · coconuts now have
// per-fruit hover cards (see CoconutHoverCards) instead of opening
// the shared Reseñas overlay modal on click.
export type AnchorKind = "cofre" | "barco" | "palmeras"

interface SceneProps {
  onAnchorClick: (anchor: AnchorKind) => void
  treasureOpen?: boolean
  onTreasureClose?: () => void
  onOpenMenu?: () => void
  // Round 95 · trackerStatus prop eliminado · tracker visual
  // (R91-R94) descartado · approach en re-evaluación.
}

/**
 * Approximate world-space positions for the 4 interaction anchors on
 * the island GLB. The GLB has these meshes baked in · the proxy groups
 * land approximately where they sit so hover hit-detection feels right.
 * Coordinates were eyeballed from the island bbox; fine-tuning happens
 * in design review · acceptable visual placement is the bar.
 */
const ANCHOR_POSITIONS: Record<AnchorKind, [number, number, number]> = {
  // Round 76 · cofre anchor Y reverted to 0.16 · I missed that R25
  // drops the whole island assembly by 0.4u AFTER the GLB loads.
  // probe-bbox.mjs reads the RAW GLB (Chest_14 center Y=0.56), but
  // in the live scene the chest sits at world Y=0.16 (0.56 − 0.4).
  // R75's bump to Y=0.56 put the box 40cm ABOVE the visible chest.
  // X and Z don't need the correction (R25 only translates Y).
  // The box geom in ANCHOR_PROXIES still matches the chest size
  // 0.75 × 0.47 × 0.67 · only the Y origin was wrong.
  cofre:    [-0.76, 0.16,  0.18],
  barco:    [-2.4,  0.30,  1.2 ],
  // Round 40 · cocos anchor removed · per-coconut hover cards in
  // CoconutHoverCards handle the Reseñas surface now.
  palmeras: [-1.6,  1.30, -1.8 ],
}

// Round 75 · per-anchor click-proxy geometry. Default is the
// invisible sphere 0.15 (R47 value) · cofre overrides with the
// exact Chest_14 AABB so the click zone matches the visible
// chest 1:1.
type ProxyGeom =
  | { shape: "sphere"; radius: number }
  | { shape: "box"; size: [number, number, number] }

const ANCHOR_PROXIES: Record<AnchorKind, ProxyGeom> = {
  // Box geom args [width, height, depth] · matches Chest_14 size.
  cofre:    { shape: "box",    size: [0.75, 0.47, 0.67] },
  barco:    { shape: "sphere", radius: 0.15 },
  palmeras: { shape: "sphere", radius: 0.15 },
}

// ANCHOR_LABELS removed in round-3 single-issue fix · the 4 drei <Html>
// floating pill labels ("Carrito" / "Historia" / "Reseñas" / "Contacto")
// were the only consumers of this map and have been deleted (per spec
// "Interactive object idle pulse" · interactivity hint is now only the
// idle pulse + cyan emissive glow).

export function Scene({
  onAnchorClick,
  treasureOpen = false,
  onTreasureClose,
  onOpenMenu,
}: SceneProps) {
  // Round 96 · auto-apply RETIRED. El descuento "SurfBollado" se
  // aplica solo cuando el usuario hace click sobre el pergamino
  // (pasada a onClaim callback en PergaminoPropModel · al click
  // dispara la animación de desaparición mágica + applyCode).
  // Antes auto-aplicaba al abrir el cofre · Emilio ·
  // "necesito que eso solo salga si se le da click al pergamino".
  const cart = useCart()
  const handleClaimDiscount = useCallback(() => {
    cart.applyCode("SurfBollado")
  }, [cart])
  // Suppress unused warnings · these props are wired into the
  // PergaminoPropModel below.
  void onTreasureClose
  void onOpenMenu
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
          {/* Round 41 · face-cam + tip buried.
              · rotation Y bumped by π (3.4416 = π + 0.3) so the flat
                face normal flips from world (-0.955, 0, 0.296) to
                (+0.955, 0, -0.296) · now points TOWARD the default
                side cam at +X (dot product with camera→surfboard
                direction = -0.89 · face faces camera).
              · Y dropped 0.925 → 0.7 so the bottom tip sits at
                Y=0.035 (sand top is 0.26) · ~0.225u of board buried,
                as per dispatch "permitir punta enterrada parcial". */}
          {/* Round 46 · rotation Y = π/2 to face the NEW front cam.
              Round 50 · X/Z moved to read "in front of" trunk.
              Round 51 · Y dropped so the keel plants in sand.
              Round 52 · X rotation 0 → 0.3 (17° tilt) so the
              tail leans BACK toward Tree_Trunk_2_30 · the
              "propped against the palm" silhouette R30 originally
              targeted, ported to the new front-cam orientation.
              The pivot is the board center · adding the tilt
              also nudges the tail in -Z by ~0.665 × sin(0.3)
              ≈ 0.197u · tail Z reaches ~-1.897 which lands at
              the front face of the trunk (trunk Z range
              [-2.14..-1.81]). */}
          <SurfboardModel position={[-1.307, 0.4, -1.7]} rotation={[0.3, Math.PI / 2, Math.PI / 2]} scale={0.7} />

          {/* R96.67 · sound/vibration distortion FX · pattern speaker
              emitting visual soundwaves · 4 rings concentricos expand
              + shake fuerte del grupo + halo central resonance blur. */}
          <CofreSoundwaveFX center={[-0.76, 0.4, 0.18]} />

          {/* Round 96.5 · props secundarios decorativos · cangrejo
              en la arena front-right (orilla del agua) · botella
              acostada front-left (message-in-a-bottle vibe). Scale
              + position son tentativos · ajustar visualmente post
              first deploy si quedan fuera de proporción. */}
          {/* R96.37 · Cowork dispatch tweaks · escala +15% en ambos ·
              crab reubicado a parte trasera de isla entre palmas (X=-1.3
              Z=-1.0) · botella elevación Y corregida (0.02→0) acostada
              en arena · alejada del barco · gap visible respecto a otros
              props ≥0.3 units world. */}
          {/* R96.40 · Cowork dispatch V2 · coords exactas + scale ×1.15
              incremental sobre actual (R96.37 0.161/0.184 → 0.185/0.212).
              Per island-3d-tweaks-2026-05-23.md sec 3.2 · botella reposa
              acostada Y=0.13 lateral · gap visible respecto barco +40%.
              Sec 3.3 · crab adentro cluster palmas anchor (X=-1.6 Z=-1.8)
              · ligeramente delante · semi-oculto entre troncos. */}
          {/* R96.55 · debug helpers en qaMode · GridHelper magenta +
              AxesHelper red/green/blue · 4 direction labels grandes
              en los extremos de los ejes (DERECHA · IZQUIERDA · FRENTE
              · ATRÁS) + 4 corner markers en las esquinas del sand mesh
              con coords (X,Z). Limpiado · sin labels por unidad que
              confundían. */}
          {qaMode ? (
            <>
              <gridHelper args={[6, 12, "#ff00ff", "#666666"]} position={[0, 0.05, 0]} />
              <axesHelper args={[3]} position={[0, 0.06, 0]} />
              {/* Direction labels grandes en los 4 extremos */}
              <Text
                position={[3.5, 0.8, 0]}
                fontSize={0.4}
                color="#ff2266"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
              >
                {"+X DERECHA →"}
              </Text>
              <Text
                position={[-3.5, 0.8, 0]}
                fontSize={0.4}
                color="#ff2266"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
              >
                {"← IZQUIERDA −X"}
              </Text>
              <Text
                position={[0, 0.8, 3.5]}
                fontSize={0.4}
                color="#22aaff"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
              >
                {"+Z FRENTE ↓"}
              </Text>
              <Text
                position={[0, 0.8, -3.5]}
                fontSize={0.4}
                color="#22aaff"
                anchorX="center"
                anchorY="middle"
                rotation={[-Math.PI / 2, 0, 0]}
              >
                {"↑ ATRÁS −Z"}
              </Text>
              {/* Corner labels · 4 esquinas del sand mesh */}
              {[
                [-2, -2],
                [2, -2],
                [-2, 2],
                [2, 2],
              ].map(([x, z], i) => (
                <Text
                  key={`corner-${i}`}
                  position={[x, 0.6, z]}
                  fontSize={0.35}
                  color="#ffff00"
                  anchorX="center"
                  anchorY="middle"
                  rotation={[-Math.PI / 2, 0, 0]}
                >
                  {`(X=${x > 0 ? "+" : ""}${x},Z=${z > 0 ? "+" : ""}${z})`}
                </Text>
              ))}
            </>
          ) : null}
          <CrabModel position={[-1.8, 0.05, -1.6]} rotation={[0, 0.6, 0]} scale={0.185} />
          <BottleModel position={[1, 0, -2]} rotation={[Math.PI / 2, 0, 0.4]} scale={0.212} />

          {/* Round 85 · pergamino emerges FROM the cofre on click.
              Round 96 · click sobre el pergamino · dispara vanish
              mágico + onClaim (aplica código de descuento). */}
          <PergaminoPropModel
            open={treasureOpen}
            onClose={onTreasureClose}
            onClaim={handleClaimDiscount}
          />
          {/* Round 95 · OrderJourneyTracker (canoa repartidor +
              casa offshore + humo + paquete + estela) eliminado ·
              approach en re-evaluación. */}

          {(Object.keys(ANCHOR_POSITIONS) as AnchorKind[]).map((kind, idx) => (
            <InteractiveAnchor
              key={kind}
              kind={kind}
              index={idx}
              position={ANCHOR_POSITIONS[kind]}
              proxy={ANCHOR_PROXIES[kind]}
              hovered={hoveredAnchor === kind}
              reducedMotion={motionInhibited}
              onHover={(h) => setHoveredAnchor(h ? kind : (prev) => (prev === kind ? null : prev as AnchorKind))}
              onClick={() => onAnchorClick(kind)}
            />
          ))}
        </PerformanceMonitor>

        {/* Round 56 · removed <ContactShadows scale={14}/> · the drei
            shadow plane rendered as a 14u² darkened square texture
            on top of the water around the island, reading as a hard
            edge against the ocean color. The directional light's
            castShadow + shadow-mapSize on the island sand mesh
            still provides real ground shadow under the chest/palms;
            we just lose the soft ambient darkening contact shadow
            that was responsible for the square. */}
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
  const { scene } = useGLTF(naufragoAssets.island, true)
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
    // Round 63 · per-coco Y/Z tuning based on R62 visual feedback:
    //   - right (10_43)  · "quedó 80% hundido"   → Y -0.05 → 0.08
    //                       Sand at back-right is higher than the
    //                       front-shore estimate · raise so only
    //                       ~20% of the coco sits in the sand.
    //   - center (11_44) · "quedó fuera de la isla y hay que
    //                       bajarlo un poco más" → Z 1.50 → 0.80
    //                       (move inland off the water edge) +
    //                       Y -0.05 → -0.10 (drop further to
    //                       actually touch the lower shore sand).
    //   - left (12_45)   · "bien ubicado solo bajo un poco más"
    //                       (interpreted as left · third "derecha"
    //                       in user msg appears to be a typo for
    //                       "izquierda" since the right was
    //                       already covered with "80% hundido")
    //                       → Y -0.05 → -0.10.
    const FALLEN_TARGETS: Array<{
      name: string
      pos: [number, number, number]
    }> = [
      // Round 70 · another "un poquito" on top of R69:
      //   center · Y -0.05 → -0.10 (drop  -0.05u)
      //   left   · Y -0.15 → -0.10 (raise +0.05u)
      //   right  · unchanged
      { name: "Coconut_10_43", pos: [ 1.40,  0.08, -0.80] }, // back-right
      { name: "Coconut_11_44", pos: [ 0.10, -0.10,  0.80] }, // front-center
      { name: "Coconut_12_45", pos: [-1.80, -0.10,  0.30] }, // left
    ]
    for (const { name, pos } of FALLEN_TARGETS) {
      const c = scene.getObjectByName(name)
      // Flag bumped r69 → r70 so the new positions apply on
      // sessions whose scene cache predates this round.
      if (c && !c.userData.r70Moved) {
        c.position.set(pos[0], pos[1], pos[2])
        c.userData.r70Moved = true
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

  // Round 39 · per-coconut taladro · cocos vibrate at their own
  // random intervals with bursts and a random phase offset.
  // Math.random() runs ONCE per scene mount (useMemo deps [scene])
  // · stable across renders, decorrelated between coconuts.
  // Round 55 · expanded from 4 to ALL 12 coconuts (3 canopy palms +
  // 3 fallen) · per user "que todos los cocos vibren igual que el
  // cofre".
  const coconutShakeTargets = useMemo(() => {
    const names = [
      "Coconut_1_3", "Coconut_2_5", "Coconut_3_4",       // central palm
      "Coconut_7_21", "Coconut_8_19", "Coconut_9_20",    // right palm
      "Coconut_4_33", "Coconut_5_32", "Coconut_6_31",    // back-left palm
      "Coconut_10_43", "Coconut_11_44", "Coconut_12_45", // fallen on sand
    ]
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

    // ── Round 31 · boat wave bobbing
    //    Round 53 · vertical amplitude dropped 0.06 → 0.025 because
    //    the R31 value read as "flying over the water" at the new
    //    R45 front cam. Rotation amplitudes kept · they sell the
    //    "wave-knocked" rocking without lifting the keel out of
    //    the water.
    const waveY = Math.sin(t * 1.2) * 0.025
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
    // shake starts at peak amplitude and drops smoothly to 0.
    // Round 42 · peak doubled 0.02 → 0.04 so the vibration reads
    // at the default camera distance. Still below the chest's
    // 0.05 uniform amplitude (chest stays the "alpha animal").
    // Round 49 · peak bumped 0.04 → 0.06 because R45 moved the
    // default cam to front [0, 4, 9] · the canopy cocos are now
    // further from the cam than they were from the old side cam,
    // and 0.04 wasn't reading. 0.06 is at chest peak (0.05) ·
    // intentional cap on "alpha animal" relaxed slightly so the
    // taladro is visible at the new distance.
    //   peak amplitude       = 0.06 (120% of chest peak)
    //   burst duration       = 0.9s (2.25× chest)
    //   amplitude envelope   = peak × (1 − phaseInBurst)²
    //     phaseInBurst = 0   → amp = 0.06   (peak)
    //     phaseInBurst = 0.5 → amp = 0.015  (quartered)
    //     phaseInBurst = 1.0 → amp = 0      (still)
    // Round 55 · cocos shake like the chest · random Math.random()
    // per-frame jitter through a 0.4s burst window with uniform
    // amplitude 0.05 rad. R54's smooth sin/cos sway replaced with
    // chest pattern (R34) verbatim, except each coco has its OWN
    // interval (3s ± 1s) + phase offset so the 12 cocos don't
    // sync · the chest itself rattles in unison while the cocos
    // pop sequentially.
    const COCO_BURST = 0.4 // matches chest CHEST_BURST
    // Round 57 · per user "que los cocos vibren más fuerte" ·
    // amplitude doubled from chest baseline 0.05 → 0.10. The cocos
    // now out-rattle the chest by 2× · intentional, since the user
    // wants the canopy motion to read clearly even with the cam
    // farther / smaller fruit silhouettes.
    const COCO_JITTER = 0.1
    for (const c of coconutShakeTargets) {
      const interval = 3 + c.intervalJitter // 2.0–4.0s
      const tAdj = t + c.phaseOffset
      const cyclePos = tAdj % interval
      if (cyclePos < COCO_BURST) {
        c.obj.rotation.x = c.baseRotX + (Math.random() - 0.5) * 2 * COCO_JITTER
        c.obj.rotation.y = c.baseRotY + (Math.random() - 0.5) * 2 * COCO_JITTER
        c.obj.rotation.z = c.baseRotZ + (Math.random() - 0.5) * 2 * COCO_JITTER
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
  const { scene } = useGLTF(naufragoAssets.sign, true)
  return <primitive object={scene} {...props} />
}

function SurfboardModel(props: React.ComponentProps<"group">) {
  const { scene } = useGLTF(naufragoAssets.surfboard, true)
  return <primitive object={scene} {...props} />
}

/**
 * CofreSoundwaveFX · R96.70 · gota = MÚLTIPLES ondas en cascada
 * decreciente. Cada drop spawnea 4 ondas con delay staggered · cada
 * onda subsecuente más débil (opacity menor · vida menor).
 *
 *  Mental model · gota cae en agua · onda primaria fuerte · onda
 *  secundaria menor · terciaria aún menor · etc. · luego pausa · otra
 *  gota cae · ciclo se repite.
 *
 *  4 ondas por drop · delay 0/0.18/0.36/0.54s · vidas 1.4/1.2/1.0/0.8s
 *  · opacities pico 0.75/0.5/0.32/0.18. Drop interval 3.2s.
 */
function CofreSoundwaveFX({ center }: { center: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)
  const ring4Ref = useRef<THREE.Mesh>(null)
  const ringRefs = [ring1Ref, ring2Ref, ring3Ref, ring4Ref]
  const RING_DELAYS = [0, 0.18, 0.36, 0.54]
  const RING_LIVES = [1.4, 1.2, 1.0, 0.8]
  const RING_PEAK_OPACITY = [0.75, 0.5, 0.32, 0.18]
  const DROP_INTERVAL = 3.2

  const startTimesRef = useRef<number[]>([0, 0, 0, 0])
  const lastDropRef = useRef(-DROP_INTERVAL) // arranca con drop al t=0

  useFrame(() => {
    const t = performance.now() * 0.001

    // Drop tick · spawn las 4 ondas con delay staggered
    if (t - lastDropRef.current >= DROP_INTERVAL) {
      for (let i = 0; i < 4; i++) {
        startTimesRef.current[i] = t + RING_DELAYS[i]
      }
      lastDropRef.current = t
    }

    // R96.71 · animate rings + compute energy total para shake sync
    let totalEnergy = 0
    ringRefs.forEach((ref, i) => {
      if (!ref.current) return
      const start = startTimesRef.current[i]
      const elapsed = t - start
      const life = RING_LIVES[i]
      if (start <= 0 || elapsed < 0 || elapsed > life) {
        ref.current.visible = false
        return
      }
      ref.current.visible = true
      const cycle = elapsed / life
      const scale = 0.2 + cycle * 1.9
      const opacity = (1 - cycle) * RING_PEAK_OPACITY[i]
      ref.current.scale.setScalar(scale)
      const mat = ref.current.material as THREE.MeshBasicMaterial
      mat.opacity = opacity
      totalEnergy += opacity
    })

    // Shake amplitude proporcional a energía cumulativa de las ondas.
    // Max teórico ≈ 1.25 (primary 0.75 + secondary 0.5 en pico). Cuando
    // todas las ondas terminan · totalEnergy=0 · cofre queda quieto
    // perfectamente sincronizado.
    const energyNorm = Math.min(totalEnergy / 1.0, 1)
    const shakeAmp = 0.028 * energyNorm
    if (groupRef.current) {
      groupRef.current.position.x = center[0] + Math.sin(t * 50) * shakeAmp
      groupRef.current.position.y = center[1] + Math.cos(t * 47) * shakeAmp * 0.7
      groupRef.current.position.z = center[2] + Math.sin(t * 53) * shakeAmp
    }
  })

  return (
    <group ref={groupRef} position={center}>
      {ringRefs.map((ref, i) => (
        <mesh key={i} ref={ref} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.5, 0.58, 48]} />
          <meshBasicMaterial
            color="#4DD4D8"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  )
}


/** R96.41 · auto-center GLB pivot · Meshy AI models suelen exportar
 *  el origen del archivo en una esquina arbitraria del bounding box ·
 *  no en el centroid del modelo. Eso hace que props.position apunte
 *  al pivot interno · NO al centro visual. Clone + Box3 + sub centroid
 *  garantiza que el position externo apunte al centro visual del prop. */
function useCenteredScene(asset: string): THREE.Group {
  const { scene } = useGLTF(asset, true)
  return useMemo(() => {
    const clone = scene.clone()
    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())
    clone.position.sub(center)
    return clone
  }, [scene])
}

function CrabModel(props: React.ComponentProps<"group">) {
  const centered = useCenteredScene(naufragoAssets.cangrejo)
  return (
    <group {...props}>
      <primitive object={centered} />
    </group>
  )
}

function BottleModel(props: React.ComponentProps<"group">) {
  const centered = useCenteredScene(naufragoAssets.botella)
  return (
    <group {...props}>
      <primitive object={centered} />
    </group>
  )
}


/**
 * PergaminoPropModel · Round 85.
 *
 * Treasure-reveal · the cofre is clicked, this pergamino emerges
 * from inside it and rises to a readable position above the
 * chest. On the way up it scales from 0 to 0.5 with a slight
 * overshoot. While visible it sways gently. Click anywhere on
 * the pergamino (or the close button) and it retracts back into
 * the cofre.
 *
 * State morphing · `posT` (0..1) animated via useFrame:
 *   posT=0 · world position [-0.76, 0.16, 0.18] (cofre center) · scale 0
 *   posT=1 · world position [-0.76, 1.40, 0.50] (above cofre)  · scale 0.5
 * Spring-like ease via critically-damped lerp on each frame.
 *
 * Text overlay · a transparent CanvasTexture is generated at
 * mount (handwritten Permanent Marker style, dark sepia ink, with
 * a hand-drawn box around the NAUFRAGO5 code). It's applied to a
 * thin plane child of the model, positioned just above the
 * pergamino's broad face on the local +Y axis (the parchment's
 * surface normal in its native GLB orientation). Because the
 * plane is a child of the same group, it rotates and animates
 * with the parchment · the writing reads as if drawn directly on
 * the paper.
 *
 * Cam-facing orientation · the parchment GLB has its broad face
 * on the local XZ plane (normal +Y). Front cam sits at
 * [0, 4, 9] looking at [0, 1, 0]. Rotation X = -1.05 rad
 * (~-60°) tips the parchment so its normal points at the cam
 * (computed from atan2(cam_y_offset, cam_z_offset) ≈ atan2(3, 9)
 * + the parchment lift).
 */
function PergaminoPropModel({
  open,
  onClose,
  onClaim,
}: {
  open?: boolean
  onClose?: () => void
  onClaim?: () => void
}) {
  const { scene } = useGLTF(naufragoAssets.pergamino, true)
  const groupRef = useRef<THREE.Group>(null)
  const reducedMotion = usePrefersReducedMotion()
  const posTRef = useRef(0) // 0 = hidden in cofre, 1 = visible above
  // Round 96.2 · vanish state · click sobre pergamino · roll-up +
  // descenso al cofre · ~0.28s (3× velocidad vs R96.1).
  // Al completar · reset + onClose.
  const [vanishing, setVanishing] = useState(false)
  const vanishRef = useRef(0) // 0..1 progress vanish animation

  // Round 89 · switch from Permanent Marker (print-style marker)
  // to Homemade Apple (true connected-cursive handwriting) per
  // user "letras concatenadas, como un humano sin alzar la mano".
  // Wait for BOTH Homemade Apple and Caveat (fallback for the
  // small label lines that need legibility) to fully load before
  // creating the canvas · otherwise system cursive fallback
  // paints first and looks like keyboard calligraphy.
  const [textTexture, setTextTexture] = useState<THREE.CanvasTexture | null>(
    null,
  )
  useEffect(() => {
    let cancelled = false
    let createdTex: THREE.CanvasTexture | null = null
    const setup = async () => {
      try {
        if (typeof document !== "undefined" && document.fonts) {
          await Promise.all([
            document.fonts.load('60px "Homemade Apple"'),
            document.fonts.load('bold 60px "Caveat"'),
            document.fonts.load('italic 36px "Caveat"'),
          ])
          await document.fonts.ready
        }
      } catch {
        /* font API unsupported · proceed with fallback */
      }
      if (cancelled) return
      const tex = createPromoTexture()
      createdTex = tex
      setTextTexture(tex)
    }
    setup()
    return () => {
      cancelled = true
      createdTex?.dispose()
    }
  }, [])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    // Vanish branch · R96.3 · roll-up + descenso al cofre ~0.22s
    //   (R96.1 ~0.85s · R96.2 ~0.28s · más violento bump final)
    //   Phase A · 0-0.55 · pergamino se enrolla · scale.x 1→0.08
    //     (simula que los bordes laterales se enrollan al centro)
    //     + spin en Z (el rollo gira mientras se enrolla)
    //   Phase B · 0.40-1.00 · el rollo desciende al cofre ·
    //     position Y/Z vuelven al origen + scale general → 0
    // Sin fade opacity · puro transform · al final pergamino
    // ocupa scale 0 dentro del cofre (igual estado pre-emerge).
    if (vanishing) {
      vanishRef.current += delta * 4.6
      const v = Math.min(vanishRef.current, 1)

      // Roll progress · easeOutQuad · 0..1 across first 55% of timeline
      const rollT = Math.min(v / 0.55, 1)
      const rollEase = 1 - Math.pow(1 - rollT, 2)

      // Return-to-cofre progress · easeInQuad · 0..1 across
      // [0.40, 1.00] · overlaps con roll para flow continuo
      const returnT = Math.max((v - 0.4) / 0.6, 0)
      const returnEase = returnT * returnT

      groupRef.current.visible = true

      // Position · de "arriba del cofre" (1.4, 0.5) → "dentro del
      // cofre" (0.16, 0.18) durante phase B
      const x = -0.76
      const y = 1.4 - returnEase * (1.4 - 0.16)
      const z = 0.5 - returnEase * (0.5 - 0.18)
      groupRef.current.position.set(x, y, z)

      // Scale · X colapsa (enroll) · luego todo encoge hacia 0
      const baseScale = 1.28
      const rolledX = 1 - rollEase * 0.92 // 1 → 0.08
      const generalShrink = 1 - returnEase // 1 → 0
      groupRef.current.scale.set(
        baseScale * rolledX * generalShrink,
        baseScale * generalShrink,
        baseScale * generalShrink,
      )

      // Rotation · mantiene tip + sway natural + agrega spin Z
      // proporcional al roll (rollo gira mientras se enrolla)
      const tipX = 1.27
      const swayY = reducedMotion ? 0 : Math.sin(performance.now() * 0.0004) * 0.06
      const rollSpinZ = rollEase * Math.PI * 0.65
      groupRef.current.rotation.set(tipX, swayY, rollSpinZ)

      if (v >= 1) {
        // Reset · pergamino vuelve a estado hidden · próximo
        // emerge (re-click cofre) lo encuentra en posT=0 limpio.
        setVanishing(false)
        vanishRef.current = 0
        posTRef.current = 0
        groupRef.current.visible = false
        onClose?.()
      }
      return
    }

    // Normal emerge/retract branch
    const target = open ? 1 : 0
    // Round 87 · MORE VIOLENT emerge · open rate 1.6 → 3.5/s
    // (full open ~0.4s · was ~0.9s). Close rate also bumped
    // for symmetric snap.
    const rate = open ? 3.5 : 3.0
    const diff = target - posTRef.current
    posTRef.current += Math.sign(diff) * Math.min(Math.abs(diff), rate * delta)
    const t = posTRef.current

    groupRef.current.visible = t > 0.005

    // Interpolate position · cofre center → above cofre
    const x = -0.76
    const y = 0.16 + t * (1.4 - 0.16)
    const z = 0.18 + t * (0.5 - 0.18)
    groupRef.current.position.set(x, y, z)
    // Round 87 · stronger overshoot · peak 1.30 (settle to 1.0).
    // Round 88 · second +60% bump per user "haslo 60 porciento
    // más grande" · final scale 0.8 → 1.28 (0.8 × 1.6).
    const easedScale = t < 1 ? t * (1.3 - 0.3 * t) : 1
    groupRef.current.scale.setScalar(easedScale * 1.28)
    // Rotation X = 1.27 (R86 · faces front cam). Sway gentle.
    const tipX = 1.27
    const swayY = reducedMotion ? 0 : Math.sin(performance.now() * 0.0004) * 0.06
    groupRef.current.rotation.set(tipX, swayY, 0)
  })

  return (
    <group
      ref={groupRef}
      visible={false}
      onClick={(e) => {
        // Click sólo válido cuando pergamino está completamente
        // visible y no está en proceso de desvanecerse. Evita
        // dobles claims o triggers durante la animación emerge.
        if (!open || vanishing || posTRef.current < 0.95) return
        e.stopPropagation()
        onClaim?.()
        vanishRef.current = 0
        setVanishing(true)
      }}
    >
      <primitive object={scene} />
      {textTexture && (
        <mesh position={[0, 0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.7, 1.3]} />
          <meshBasicMaterial
            map={textTexture}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
    </group>
  )
}

/**
 * Generate the handwritten promo overlay as a CanvasTexture.
 * Uses Permanent Marker (loaded as --font-marker) for scrawled
 * castaway-style handwriting in dark sepia ink. Background is
 * transparent so the parchment's baked texture shows through.
 *
 * Returns null on SSR / when canvas2D unavailable · the caller
 * guards with `textTexture && <mesh>`.
 */
function createPromoTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null
  const canvas = document.createElement("canvas")
  canvas.width = 1024
  canvas.height = 768
  const ctx = canvas.getContext("2d")
  if (!ctx) return null

  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Round 88 · contrast bump · ink darkened #3a2818 → #0d0a06
  // (near-black warm). Combined with the kraft-tan parchment
  // beneath, the lift in luminance contrast is ~3× · letters
  // read cleanly even on the darker stained zones of the
  // baked baseColor texture.
  const INK = "#0d0a06"
  ctx.fillStyle = INK
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  // Round 90 · per-line color · default near-black INK, opt-in
  // accent colors for emphasized lines (red for the code +
  // discount headline). Stroke + fill both pick up the color
  // so the double-pass stays faithful to the silhouette.
  function lineAt(
    text: string,
    x: number,
    y: number,
    font: string,
    rotateRad = 0,
    color: string = INK,
  ) {
    ctx!.save()
    ctx!.translate(x, y)
    ctx!.rotate(rotateRad)
    ctx!.font = font
    ctx!.lineWidth = 2.2
    ctx!.lineJoin = "round"
    ctx!.strokeStyle = color
    ctx!.fillStyle = color
    ctx!.strokeText(text, 0, 0)
    ctx!.fillText(text, 0, 0)
    ctx!.restore()
  }

  // Round 90 · red ink for the code and discount headline ·
  // wine-red close to PromoTicker's #CC0000 but slightly deeper
  // (#B91C1C · red-700) so it reads like an inked seal stamp
  // against the kraft parchment.
  const RED = "#B91C1C"

  // Round 89 · true connected-cursive handwritten stack.
  // Homemade Apple is the primary · realistic one-stroke
  // handwriting where letters flow continuously (the look of
  // a castaway scribbling with a quill). Caveat is the
  // fallback · a slightly cleaner but still informal cursive
  // for platforms that haven't loaded Homemade Apple yet.
  const handwritten =
    '"Homemade Apple", "Caveat", "Snell Roundhand", cursive'
  // Caveat is used directly for the smaller labels (Código
  // Promo · — El Náufrago) where Homemade Apple becomes
  // hard to read · script font swap for legibility.
  const handwrittenLegible =
    '"Caveat", "Homemade Apple", "Brush Script MT", cursive'

  // Round 89 · Homemade Apple ships a single regular weight ·
  // "bold" requests are silently no-ops (the font face simply
  // has no bold variant) · we keep the keyword for the canvas
  // API engine which will pick the closest match (regular)
  // gracefully. Slight per-line rotation is what sells the
  // hand-written feel · the font does the rest.
  //
  // Round 90 · "Has encontrado el Tesoro de Náufrago" -20% size
  // per user · 64/68 → 51/54px.
  lineAt(
    "¡ Has encontrado",
    512,
    150,
    `51px ${handwritten}`,
    -0.025,
  )
  lineAt(
    "el Tesoro de Náufrago !",
    512,
    220,
    `54px ${handwritten}`,
    0.018,
  )

  // Spacer · ink swash divider · Round 88 · stronger ink
  ctx.strokeStyle = "rgba(13,10,6,0.75)"
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.moveTo(260, 270)
  for (let i = 0; i <= 10; i++) {
    const x = 260 + i * 50
    const y = 270 + (i % 2 === 0 ? -3 : 3)
    ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Round 90 · "Código Promo" +30% size per user · 46 → 60px
  lineAt("Código Promo", 512, 332, `60px ${handwrittenLegible}`, -0.02)

  // Hand-drawn box around the code · double-stroke "sketchy"
  // Round 88 · stroke thicker (5 → 7) + faded pass darker
  // (rgba 0.4 → 0.65) for stronger contrast against parchment.
  ctx.strokeStyle = INK
  ctx.lineWidth = 7
  ctx.beginPath()
  ctx.moveTo(192, 380)
  ctx.lineTo(836, 374)
  ctx.lineTo(840, 480)
  ctx.lineTo(190, 484)
  ctx.closePath()
  ctx.stroke()
  ctx.strokeStyle = "rgba(13,10,6,0.65)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(196, 384)
  ctx.lineTo(832, 378)
  ctx.lineTo(836, 476)
  ctx.lineTo(194, 480)
  ctx.closePath()
  ctx.stroke()

  // Round 90 · "SurfBollado" RED per user · Caveat bold for
  // legibility of mixed-case code on a single word.
  ctx.fillStyle = INK
  lineAt(
    "“SurfBollado”",
    518,
    432,
    `bold 100px ${handwrittenLegible}`,
    -0.012,
    RED,
  )

  // Round 90 · "5% Off" → "5% DSCT" + RED + Caveat bold (the
  // 5 in Homemade Apple reads as a wild squiggle · the user
  // explicitly flagged "no se entiende que es un número 5" ·
  // Caveat's bold weight renders 5 as a clean numeral).
  lineAt("5% DSCT", 512, 582, `bold 132px ${handwrittenLegible}`, -0.028, RED)

  // Signature · Caveat italic so the rúbrica is legible
  lineAt(
    "— El Náufrago",
    760,
    700,
    `42px ${handwrittenLegible}`,
    -0.05,
  )

  // Sea-wave squiggle under the signature · Round 88 darker ink
  ctx.strokeStyle = "rgba(13,10,6,0.85)"
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(630, 730)
  for (let i = 0; i <= 6; i++) {
    const x = 630 + i * 25
    const y = 730 + ((i % 2 === 0 ? -1 : 1) * 4)
    ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Small ink-blot stains for authenticity
  ctx.fillStyle = "rgba(13,10,6,0.22)"
  ctx.beginPath()
  ctx.arc(180, 530, 9, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(860, 290, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(880, 695, 11, 0, Math.PI * 2)
  ctx.fill()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
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
  const { scene, animations } = useGLTF(naufragoAssets.character, true)
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
 * CoconutHoverCards · Round 40 · per-coconut hover review profile.
 *
 *  - 4 cocos · each with an invisible hover-proxy mesh + a drei
 *    <Html> review card anchored above
 *  - onPointerEnter shows the card · onPointerLeave hides it
 *  - mobile tap toggles; auto-dismiss after 3s
 *  - framer-motion fade · 200ms in / 150ms out
 *  - card · DiceBear avatar 80px (seeded by name) + name + location
 *    + italic review quote + ⭐ row
 */
interface CocoReview {
  coconutName: string
  name: string
  location: string
  review: string
  rating: number
  /** Per-coconut Y offset for the hover proxy. Canopy cocos hover
   *  fine at 0.2 but the fallen Coconut_10_43 (Y=0.06) sits inside
   *  the sand cylinder · its proxy needs a bigger lift to clear the
   *  sand mesh raycast. */
  proxyYOffset: number
  /** Round 83 · optional real customer photo. When undefined, the
   *  ReviewCard falls back to a DiceBear cartoon avatar seeded by
   *  the name. Path is relative to `/public` (e.g.
   *  "/reviews/01-hombre-drone.jpg") OR a full https URL when the
   *  photo is hosted off-domain. */
  photoUrl?: string
}

const COCONUT_REVIEWS: CocoReview[] = [
  // Round 55 · hover proxies centered on the coco mesh (proxyYOffset
  // 0 / small) for precise hit-testing per user "ubica bien el area
  // de hover · hasla bien precisa". Canopy cocos: offset = 0
  // (sphere center matches coco center). Fallen cocos: offset = 0.1
  // (small lift to clear the sand mesh raycast · sphere bottom
  // tangent at sand level Y=0.06 + 0 = -0.09, well clear).
  // Round 83 · photoUrl wired for 4 of 6 reviewers per CC4 dispatch.
  // Mapping decided here (Emilio delegated):
  //   foto-1 drone-antártida  → Diego R.  (Manglaralto · outdoor adventure)
  //   foto-2 outdoor-lentes   → Pablo G.  (Olón · relaxed portrait fits family-man)
  //   foto-3 joven-perro      → Andrea P. (Punta Blanca · home-ordering convenience)
  //   foto-4 cumpleaños #6    → María C.  (Olón · on-time delivery for a celebration)
  // Carlos M. + Lucía F. keep the DiceBear fallback (gender-mixed
  // unphotographed pair · 2M + 2F balance preserved overall).
  {
    coconutName: "Coconut_1_3",
    name: "María C.",
    location: "Olón",
    review:
      "Pedí encebollado a las 11am y llegó a las 11:35am tibio · caldo perfecto.",
    rating: 5,
    proxyYOffset: 0,
    photoUrl: "/reviews/reviewer-4-maria.jpg",
  },
  {
    coconutName: "Coconut_2_5",
    name: "Diego R.",
    location: "Manglaralto",
    review:
      "El ceviche tiene sabor de mercado · fresco · ácido justo.",
    rating: 5,
    proxyYOffset: 0,
    photoUrl: "/reviews/reviewer-1-diego.jpg",
  },
  {
    coconutName: "Coconut_3_4",
    name: "Andrea P.",
    location: "Punta Blanca",
    review: "Pides por WhatsApp y listo · nada de filas.",
    rating: 5,
    proxyYOffset: 0,
    photoUrl: "/reviews/reviewer-3-andrea.jpg",
  },
  {
    coconutName: "Coconut_10_43",
    name: "Carlos M.",
    location: "Olón",
    review: "Patacones perfectos · sal prieta auténtica.",
    rating: 5,
    proxyYOffset: 0.1,
    photoUrl: "/reviews/reviewer-5.jpg",
  },
  {
    coconutName: "Coconut_11_44",
    name: "Lucía F.",
    location: "Manglaralto",
    review:
      "Hicieron mi pedido completo en 25 minutos · calidad como en mesa.",
    rating: 5,
    proxyYOffset: 0.1,
    photoUrl: "/reviews/reviewer-6.jpg",
  },
  {
    coconutName: "Coconut_12_45",
    name: "Pablo G.",
    location: "Olón",
    review: "Lo pedí para reunión familiar · llegó a tiempo · todos contentos.",
    rating: 5,
    proxyYOffset: 0.1,
    photoUrl: "/reviews/reviewer-2-pablo.jpg",
  },
]

function ReviewCard({ review }: { review: CocoReview }) {
  // Round 58 · palette corrected to match the SignModel sign on the
  // sand (the wooden NÁUFRAGO panel staked in the beach), NOT the
  // chest face the R57 attempt used. The actual sign has TWO colors
  // only: morado (purple plank · #7c3aed, the same violet as the
  // SpeechBubble) and celeste (light cyan letters · #4DD4D8, the
  // same cyan as the hero NÁUFRAGO highlight). Card recolored
  // strictly to those two.
  // Round 83 · real customer photo when present, DiceBear cartoon
  // fallback when not. Falls back automatically on broken image
  // (404, network error) via onError handler below.
  const fallbackAvatarUrl = `https://api.dicebear.com/7.x/micah/svg?seed=${encodeURIComponent(review.name)}&size=80`
  const avatarUrl = review.photoUrl ?? fallbackAvatarUrl
  return (
    <div
      style={{
        // Round 59 · morado bg darkened per user "el morado del
        // fondo de la reseña es más oscuro" · #7c3aed (violet-600)
        // → #4c1d95 (violet-900) · matches the deeper purple read
        // off the actual SignModel plank.
        background: "rgba(76, 29, 149, 0.96)",
        border: "1px solid rgba(77, 212, 216, 0.7)",
        backdropFilter: "blur(8px)",
        borderRadius: "10px",
        padding: "12px",
        maxWidth: "380px",
        minWidth: "300px",
        display: "flex",
        gap: "12px",
        alignItems: "flex-start",
        color: "#4DD4D8",
        fontFamily: 'var(--font-inter), system-ui, -apple-system, sans-serif',
        boxShadow: "0 12px 32px rgba(46, 16, 101, 0.55)",
      }}
    >
      <img
        src={avatarUrl}
        alt={review.name}
        width={80}
        height={80}
        onError={(e) => {
          // Round 83 · real photo failed (broken path, network error)
          // · swap to DiceBear cartoon so the card never shows a
          // broken-image icon.
          const img = e.currentTarget
          if (img.src !== fallbackAvatarUrl) img.src = fallbackAvatarUrl
        }}
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "8px",
          flexShrink: 0,
          background: "rgba(77, 212, 216, 0.15)",
          objectFit: "cover",
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "#4DD4D8",
            lineHeight: "1.2",
          }}
        >
          {review.name}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "rgba(77, 212, 216, 0.75)",
            marginTop: "1px",
            marginBottom: "6px",
            letterSpacing: "0.02em",
          }}
        >
          {review.location}
        </div>
        <p
          style={{
            fontSize: "12.5px",
            fontStyle: "italic",
            lineHeight: "1.45",
            color: "#4DD4D8",
            margin: 0,
            marginBottom: "6px",
          }}
        >
          “{review.review}”
        </p>
        <div
          style={{
            display: "flex",
            gap: "1px",
            color: "#4DD4D8",
            fontSize: "13px",
            letterSpacing: "0.02em",
          }}
        >
          {"★".repeat(review.rating)}
          <span style={{ color: "rgba(77, 212, 216, 0.3)" }}>
            {"★".repeat(5 - review.rating)}
          </span>
        </div>
      </div>
    </div>
  )
}

function CoconutHoverCards() {
  const { scene } = useGLTF(naufragoAssets.island, true)
  const [hovered, setHovered] = useState<string | null>(null)
  const [targets, setTargets] = useState<
    Array<{ review: CocoReview; pos: [number, number, number] }>
  >([])
  const dismissTimerRef = useRef<number | null>(null)

  // Coconut group local positions = world positions in this GLB
  // (all parents · Sketchfab_Scene → Sketchfab_model → root →
  // GLTF_SceneRootNode · are at identity translation/rotation/scale,
  // verified via probe-coconuts.mjs). Reading obj.position.{x,y,z}
  // directly avoids matrixWorld staleness · the R25 useEffect in
  // IslandModel mutates obj.position.y but doesn'\''t auto-flush
  // matrixWorld, so getWorldPosition() can return pre-mutation
  // values on the same tick. Local read is always current.
  useEffect(() => {
    const computed = COCONUT_REVIEWS.map((review) => {
      const obj = scene.getObjectByName(review.coconutName)
      if (!obj) return null
      return {
        review,
        pos: [obj.position.x, obj.position.y, obj.position.z] as [
          number,
          number,
          number,
        ],
      }
    }).filter(
      (t): t is { review: CocoReview; pos: [number, number, number] } =>
        t !== null,
    )
    setTargets(computed)
  }, [scene])

  const setHover = (key: string | null) => {
    setHovered(key)
    if (dismissTimerRef.current !== null) {
      window.clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = null
    }
    // Mobile auto-dismiss · 3s
    if (key) {
      dismissTimerRef.current = window.setTimeout(() => {
        setHovered(null)
        dismissTimerRef.current = null
      }, 3000)
    }
  }

  return (
    <group>
      {targets.map(({ review, pos }) => (
        <group key={review.coconutName} position={pos}>
          {/* Hover-proxy sphere · per-coconut Y offset (canopy 0.2,
              fallen 0.6 to clear the sand cylinder raycast).
              Round 43 · radius 0.4 → 0.15 so cards fire ONLY when
              the cursor is on the coconut itself, not on the
              surrounding air (~18px screen footprint at default
              cam distance · matches the scaled fruit size). */}
          <mesh
            position={[0, review.proxyYOffset, 0]}
            onPointerEnter={(e) => {
              e.stopPropagation()
              document.body.style.cursor = "pointer"
              setHover(review.coconutName)
            }}
            onPointerLeave={(e) => {
              e.stopPropagation()
              document.body.style.cursor = "auto"
              setHover(null)
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              setHover(hovered === review.coconutName ? null : review.coconutName)
            }}
          >
            <sphereGeometry args={[0.15, 12, 12]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* Floating review card · above the coconut · ignores
              occlusion so palm leaves can'\''t hide it. Round 57 ·
              Y offset 0.35 → 1.1 + distanceFactor 5 → 7 so the
              card floats well above the coco and reads smaller ·
              user "que se abra a una distancia más grande así no
              tapa el click ni el resto de elementos cercanos". */}
          <Html
            position={[0, 1.1, 0]}
            center
            distanceFactor={7}
            zIndexRange={[120, 0]}
            style={{ pointerEvents: "none" }}
          >
            <AnimatePresence>
              {hovered === review.coconutName && (
                <motion.div
                  key="card"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{
                    opacity: { duration: 0.2, ease: "easeOut" },
                    y: { duration: 0.2, ease: "easeOut" },
                  }}
                >
                  <ReviewCard review={review} />
                </motion.div>
              )}
            </AnimatePresence>
          </Html>
        </group>
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
      <CoconutHoverCards />
      <group
        /* Round 32 · character flotante fix · Y 0.1 → -0.075 ·
           landed feet at chest-base sand reference.
           Round 66 · per user "sube un poco el esqueleto no mucho
           así mismo como los cocos vamos de a poco" · Y -0.075 →
           -0.025 (+0.05u · same delta size as the coco "un
           poquito" tuning). Feet now sit slightly above the
           chest-base sand · subtle lift. */
        position={[0, -0.025, 0]}
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
  // Round 75 · per-anchor click-proxy geometry. Defaults to the
  // R47 sphere(0.15) if omitted. Cofre overrides to a box matching
  // the actual Chest_14 AABB so the click zone covers the whole
  // visible chest (75×47×67cm) instead of a 30cm sphere offset
  // below it.
  proxy?: ProxyGeom
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
  proxy,
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
        {/* Round 75 · proxy geometry varies per anchor. Defaults to
            sphere(0.15) (R47) for barco + palmeras · cofre passes a
            box matching Chest_14 AABB so the entire chest is
            clickable. Mesh is invisible (R6 · meshBasicMaterial
            opacity 0 + depthWrite off) but raycast hits regardless
            of shape. */}
        {proxy?.shape === "box" ? (
          <boxGeometry args={proxy.size} />
        ) : (
          <sphereGeometry args={[proxy?.radius ?? 0.15, 16, 16]} />
        )}
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
