/**
 * Round 27 forensic · probe the exact world transforms of the boat
 * and its two oars in the island GLB. Round 22 only mutated their
 * position.y by -0.36 · rotation and scale were left untouched. So
 * any tilt seen on the deployed scene is GLB-intrinsic.
 *
 * Captures, for each of Boat_15, Oar_1_16, Oar_2_17:
 *   - local position / rotation (Euler in radians + degrees) / scale
 *   - WORLD position / rotation / scale (post all parent transforms)
 *   - bbox center + size in world space
 *   - direction vectors (forward, right, up) so we can visualize tilt
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

globalThis.self = globalThis

const URL =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/island-low-poly.glb"

console.log("→ fetching", URL)
const res = await fetch(URL)
console.log("  HTTP", res.status)
const ab = await res.arrayBuffer()
const gltf = await new Promise((res, rej) =>
  new GLTFLoader().parse(ab, "", res, rej),
)
gltf.scene.updateMatrixWorld(true)

function dump(name) {
  const obj = gltf.scene.getObjectByName(name)
  if (!obj) {
    console.log(`\n=== ${name} · NOT FOUND ===`)
    return
  }
  console.log(`\n=== ${name} ===`)
  console.log(`  local position : (${obj.position.x.toFixed(3)}, ${obj.position.y.toFixed(3)}, ${obj.position.z.toFixed(3)})`)
  const er = obj.rotation
  console.log(`  local rotation : (${er.x.toFixed(3)}, ${er.y.toFixed(3)}, ${er.z.toFixed(3)}) rad`)
  console.log(`                 : (${THREE.MathUtils.radToDeg(er.x).toFixed(1)}°, ${THREE.MathUtils.radToDeg(er.y).toFixed(1)}°, ${THREE.MathUtils.radToDeg(er.z).toFixed(1)}°)`)
  console.log(`  local scale    : (${obj.scale.x.toFixed(3)}, ${obj.scale.y.toFixed(3)}, ${obj.scale.z.toFixed(3)})`)

  const wPos = new THREE.Vector3()
  const wQuat = new THREE.Quaternion()
  const wScale = new THREE.Vector3()
  obj.matrixWorld.decompose(wPos, wQuat, wScale)
  const wEuler = new THREE.Euler().setFromQuaternion(wQuat, "XYZ")
  console.log(`  world position : (${wPos.x.toFixed(3)}, ${wPos.y.toFixed(3)}, ${wPos.z.toFixed(3)})`)
  console.log(`  world rotation : (${wEuler.x.toFixed(3)}, ${wEuler.y.toFixed(3)}, ${wEuler.z.toFixed(3)}) rad`)
  console.log(`                 : (${THREE.MathUtils.radToDeg(wEuler.x).toFixed(1)}°, ${THREE.MathUtils.radToDeg(wEuler.y).toFixed(1)}°, ${THREE.MathUtils.radToDeg(wEuler.z).toFixed(1)}°)`)
  console.log(`  world scale    : (${wScale.x.toFixed(3)}, ${wScale.y.toFixed(3)}, ${wScale.z.toFixed(3)})`)

  // Direction vectors in world space
  const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(wQuat)
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(wQuat)
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(wQuat)
  console.log(`  world fwd  (+Z): (${fwd.x.toFixed(2)}, ${fwd.y.toFixed(2)}, ${fwd.z.toFixed(2)})`)
  console.log(`  world right(+X): (${right.x.toFixed(2)}, ${right.y.toFixed(2)}, ${right.z.toFixed(2)})`)
  console.log(`  world up   (+Y): (${up.x.toFixed(2)}, ${up.y.toFixed(2)}, ${up.z.toFixed(2)})`)

  // Bbox
  const bb = new THREE.Box3().setFromObject(obj)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bb.getCenter(center)
  bb.getSize(size)
  console.log(`  bbox center    : (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`)
  console.log(`  bbox size      : (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`)
  console.log(`  bbox Y range   : [${bb.min.y.toFixed(3)} .. ${bb.max.y.toFixed(3)}]`)

  // Up-vector tilt: how far does the object's local +Y tilt from world +Y?
  const tiltDeg = THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(up.dot(new THREE.Vector3(0, 1, 0)), -1, 1)))
  console.log(`  TILT vs world+Y: ${tiltDeg.toFixed(1)}°`)
}

dump("Boat_15")
dump("Oar_1_16")
dump("Oar_2_17")

console.log("\n=== INTERPRETATION HINTS ===")
console.log("  TILT vs world+Y > 5° → object axis is leaning · likely")
console.log("  intentional GLB design (e.g. oar resting against boat).")
console.log("  TILT ≈ 0 → object stands upright relative to world.")
console.log("\nRound 22 ONLY mutated position.y on Boat_15 + Oar_1_16 + Oar_2_17.")
console.log("Any rotation seen here came directly from the GLB asset.")
