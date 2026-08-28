/**
 * Round 33 REDO · audit ALL 3 palm trunks post-Round-25 + identify
 * the one visible from default cam [9, 4, 0] looking at origin.
 *
 * Default cam right axis ≈ -Z · things at more negative Z appear
 * further right in screen. So the "left-in-screen" palm is the one
 * with the LEAST NEGATIVE Z. The camera also gets closer to the +X
 * side, so palms at higher X are nearer the lens.
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

globalThis.self = globalThis

const URL =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/island-low-poly.glb"

const res = await fetch(URL)
const ab = await res.arrayBuffer()
const gltf = await new Promise((res, rej) =>
  new GLTFLoader().parse(ab, "", res, rej),
)

// Simulate Round 25 island drop
const root = gltf.scene.getObjectByName("GLTF_SceneRootNode")
if (root) {
  const exempt = new Set(["Ocean001_57", "Cube_59", "Boat_15", "Oar_1_16", "Oar_2_17"])
  for (const child of root.children) {
    if (!exempt.has(child.name)) child.position.y -= 0.4
  }
}
gltf.scene.updateMatrixWorld(true)

const trunks = ["Tree_Trunk_1_2", "Tree_Trunk_2_30", "Tree_Trunk_3_18"]
for (const name of trunks) {
  const obj = gltf.scene.getObjectByName(name)
  if (!obj) {
    console.log(`\n=== ${name} · NOT FOUND ===`)
    continue
  }
  const bb = new THREE.Box3().setFromObject(obj)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bb.getCenter(center)
  bb.getSize(size)
  console.log(`\n=== ${name} ===`)
  console.log(`  world center : (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`)
  console.log(`  world size   : (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`)
  console.log(`  X range      : [${bb.min.x.toFixed(3)} .. ${bb.max.x.toFixed(3)}]`)
  console.log(`  Y range      : [${bb.min.y.toFixed(3)} .. ${bb.max.y.toFixed(3)}]`)
  console.log(`  Z range      : [${bb.min.z.toFixed(3)} .. ${bb.max.z.toFixed(3)}]`)
  // Visibility heuristic from cam [9, 4, 0] looking origin:
  //   - Closer to camera = higher X
  //   - More right in screen = more negative Z
  console.log(`  cam X-dist   : ${(9 - center.x).toFixed(2)}u  (smaller = closer to lens)`)
  console.log(`  screen pos   : ${center.z > -1 ? "left/center" : "right-back"}`)
}

// Now compute surfboard contact target for the LEFT-FRONT palm (best
// match per dispatch: X > -1.5, Z near 0 → Tree_Trunk_1_2 central).
const palm = gltf.scene.getObjectByName("Tree_Trunk_1_2")
if (palm) {
  const bb = new THREE.Box3().setFromObject(palm)
  const palmCenter = new THREE.Vector3()
  bb.getCenter(palmCenter)
  const SURF_X_HALF = 0.120
  const SURF_Y_HALF = 0.665
  const SURF_Z_HALF = 0.197
  const SAND_TOP_Y = 0.26
  console.log(`\n=== Surfboard target · against Tree_Trunk_1_2 ===`)
  console.log(`  Trunk world Z range : [${bb.min.z.toFixed(3)} .. ${bb.max.z.toFixed(3)}]`)
  // Place surfboard so its Z max touches trunk Z min (surfboard behind
  // palm from camera POV · they appear side-by-side in screen, both
  // visible, neither occluding the other).
  const surfZ = bb.min.z - SURF_Z_HALF
  const surfX = palmCenter.x
  const surfY = SAND_TOP_Y + SURF_Y_HALF
  console.log(`  Target position     : [${surfX.toFixed(3)}, ${surfY.toFixed(3)}, ${surfZ.toFixed(3)}]`)
  console.log(`  Surfboard X range   : [${(surfX - SURF_X_HALF).toFixed(3)} .. ${(surfX + SURF_X_HALF).toFixed(3)}]  (same X as palm)`)
  console.log(`  Surfboard Z range   : [${(surfZ - SURF_Z_HALF).toFixed(3)} .. ${(surfZ + SURF_Z_HALF).toFixed(3)}]  (max touches trunk Z min ${bb.min.z.toFixed(3)})`)
  console.log(`  Surfboard Y range   : [${(surfY - SURF_Y_HALF).toFixed(3)} .. ${(surfY + SURF_Y_HALF).toFixed(3)}]  (keel on sand top)`)
}
