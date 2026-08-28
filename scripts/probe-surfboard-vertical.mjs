/**
 * Round 30 forensic · compute the surfboard's world bbox AFTER the
 * target rotation [0, 0.3, Math.PI/2] and scale 0.7. Tells us:
 *   - exact Y half-extent (so we can place the keel on the sand top
 *     at Y=0.26 post-Round-25)
 *   - XZ footprint to verify it doesn't collide with the palm trunk
 *     or other props
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

globalThis.self = globalThis

const URL =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/surfboard-old.glb"

const res = await fetch(URL)
const ab = await res.arrayBuffer()
const gltf = await new Promise((res, rej) =>
  new GLTFLoader().parse(ab, "", res, rej),
)

// Apply target transform · rotation [0, 0.3, Math.PI/2] · scale 0.7
gltf.scene.rotation.set(0, 0.3, Math.PI / 2)
gltf.scene.scale.setScalar(0.7)
gltf.scene.updateMatrixWorld(true)

const bb = new THREE.Box3().setFromObject(gltf.scene)
const center = new THREE.Vector3()
const size = new THREE.Vector3()
bb.getCenter(center)
bb.getSize(size)

console.log("=== Surfboard · rotation [0, 0.3, π/2] · scale 0.7 ===")
console.log(`  bbox center : (${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)})`)
console.log(`  bbox size   : (${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)})`)
console.log(`  X half-ext  : ${(size.x / 2).toFixed(3)}`)
console.log(`  Y half-ext  : ${(size.y / 2).toFixed(3)}   ← keel-to-tip half`)
console.log(`  Z half-ext  : ${(size.z / 2).toFixed(3)}`)

const SAND_TOP_Y = 0.26 // post-Round-25 sand AABB top
const yHalf = size.y / 2
const targetY = SAND_TOP_Y + yHalf
console.log(`\n=== Placement math (keel touches sand top Y=${SAND_TOP_Y}) ===`)
console.log(`  required center Y = sand_top + Y_half = ${SAND_TOP_Y} + ${yHalf.toFixed(3)} = ${targetY.toFixed(3)}`)

const X_CENTER = -1.5
const Z_CENTER = -0.7
const xHalf = size.x / 2
const zHalf = size.z / 2
console.log(`\n=== Footprint at [${X_CENTER}, ${targetY.toFixed(3)}, ${Z_CENTER}] ===`)
console.log(`  X range : [${(X_CENTER - xHalf).toFixed(2)} .. ${(X_CENTER + xHalf).toFixed(2)}]`)
console.log(`  Y range : [${(targetY - yHalf).toFixed(2)} .. ${(targetY + yHalf).toFixed(2)}]`)
console.log(`  Z range : [${(Z_CENTER - zHalf).toFixed(2)} .. ${(Z_CENTER + zHalf).toFixed(2)}]`)

// Collision check vs known objects (positions are world post-Round-25)
console.log(`\n=== Collision audit ===`)
const candidates = [
  { name: "Sand bounds (must contain)", xRange: [-2.82, 2.75], zRange: [-3.66, 1.57] },
  { name: "Chest_14 (post-25)", xRange: [-1.14, -0.39], zRange: [-0.05, 0.41] },
  { name: "Tree_Trunk_2_30 (left-back palm)", xRange: [-1.40, -1.12], zRange: [-2.07, -1.75] },
  { name: "Rock_6_53 (left rock)", xRange: [-1.60, -1.32], zRange: [-1.015, -0.785] },
  { name: "Rock_7_47 (left rock)", xRange: [-1.85, -1.53], zRange: [+0.285, +0.615] },
  { name: "Character (post-25)", xRange: [-0.26, +0.06], zRange: [+0.22, +0.38] },
  { name: "Sign (post-25)", xRange: [-0.10, +1.70], zRange: [-0.08, +1.08] },
]
for (const c of candidates) {
  const xOverlap = Math.max(0, Math.min(X_CENTER + xHalf, c.xRange[1]) - Math.max(X_CENTER - xHalf, c.xRange[0]))
  const zOverlap = Math.max(0, Math.min(Z_CENTER + zHalf, c.zRange[1]) - Math.max(Z_CENTER - zHalf, c.zRange[0]))
  if (c.name.startsWith("Sand bounds")) {
    const inside = X_CENTER - xHalf >= c.xRange[0] && X_CENTER + xHalf <= c.xRange[1] && Z_CENTER - zHalf >= c.zRange[0] && Z_CENTER + zHalf <= c.zRange[1]
    console.log(`  ${c.name.padEnd(35)} ${inside ? "✓ inside" : "✗ OUTSIDE"}`)
  } else {
    const status = (xOverlap > 0 && zOverlap > 0) ? `✗ OVERLAP X=${xOverlap.toFixed(2)} Z=${zOverlap.toFixed(2)}` : "✓ no overlap"
    console.log(`  ${c.name.padEnd(35)} ${status}`)
  }
}
