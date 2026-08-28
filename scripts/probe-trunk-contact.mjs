/**
 * Round 33 forensic · find the exact world bbox of Tree_Trunk_2_30
 * AFTER simulating the Round 25 island drop (-0.4 on the group),
 * and compute the target surfboard X/Z so its edge contacts the
 * trunk's edge (0u gap).
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

// Apply Round 25 drop to Tree_Trunk_2_30 (and palms in general)
const trunk = gltf.scene.getObjectByName("Tree_Trunk_2_30")
if (!trunk) {
  console.log("trunk not found")
  process.exit(1)
}
trunk.position.y -= 0.4  // simulate Round 25 drop
gltf.scene.updateMatrixWorld(true)

const bb = new THREE.Box3().setFromObject(trunk)
const center = new THREE.Vector3()
const size = new THREE.Vector3()
bb.getCenter(center)
bb.getSize(size)

console.log("=== Tree_Trunk_2_30 · post-Round-25 (Y -= 0.4) ===")
console.log(`  world center : (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`)
console.log(`  world size   : (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`)
console.log(`  X range      : [${bb.min.x.toFixed(3)} .. ${bb.max.x.toFixed(3)}]`)
console.log(`  Y range      : [${bb.min.y.toFixed(3)} .. ${bb.max.y.toFixed(3)}]`)
console.log(`  Z range      : [${bb.min.z.toFixed(3)} .. ${bb.max.z.toFixed(3)}]`)

// Surfboard half-extents after rotation [0, 0.3, π/2] · scale 0.7
// (from Round 30 probe · re-derived for clarity)
const SURF_X_HALF = 0.241 / 2
const SURF_Y_HALF = 1.329 / 2
const SURF_Z_HALF = 0.393 / 2
const SAND_TOP_Y = 0.26
const surfCenterY = SAND_TOP_Y + SURF_Y_HALF

console.log("\n=== Surfboard target (contact left side of trunk) ===")
console.log(`  Surfboard half-extents : X=${SURF_X_HALF.toFixed(3)} Y=${SURF_Y_HALF.toFixed(3)} Z=${SURF_Z_HALF.toFixed(3)}`)
// Place surfboard so its X max = trunk X min (touch left side)
const surfX = bb.min.x - SURF_X_HALF
// Center Z aligned with trunk center so surfboard runs along trunk side
const surfZ = center.z
console.log(`  Target position        : [${surfX.toFixed(3)}, ${surfCenterY.toFixed(3)}, ${surfZ.toFixed(3)}]`)
console.log(`  Surfboard X range      : [${(surfX - SURF_X_HALF).toFixed(3)} .. ${(surfX + SURF_X_HALF).toFixed(3)}]  (max touches trunk X min ${bb.min.x.toFixed(3)})`)
console.log(`  Surfboard Z range      : [${(surfZ - SURF_Z_HALF).toFixed(3)} .. ${(surfZ + SURF_Z_HALF).toFixed(3)}]  (within trunk Z [${bb.min.z.toFixed(3)} .. ${bb.max.z.toFixed(3)}])`)

console.log("\n=== Sand bounds check ===")
console.log(`  X[-2.82..+2.75] contains [${(surfX - SURF_X_HALF).toFixed(2)}..${(surfX + SURF_X_HALF).toFixed(2)}] ?  ${(surfX - SURF_X_HALF) >= -2.82 && (surfX + SURF_X_HALF) <= 2.75 ? "✓" : "✗"}`)
console.log(`  Z[-3.66..+1.57] contains [${(surfZ - SURF_Z_HALF).toFixed(2)}..${(surfZ + SURF_Z_HALF).toFixed(2)}] ?  ${(surfZ - SURF_Z_HALF) >= -3.66 && (surfZ + SURF_Z_HALF) <= 1.57 ? "✓" : "✗"}`)
