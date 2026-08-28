/**
 * Round 15 forensic · probe character GLB bbox vs the island sand
 * surface so we can compute the exact Y delta to lift the character
 * out of the sand.
 *
 * Computes:
 *   - Character GLB local bbox · pivot offset
 *   - After scale 0.6 (current value in Scene.tsx · CharacterModel)
 *   - Character world position from Scene.tsx · parent group Y=0.05,
 *     CharacterModel position [-0.1, 0, 0.3] · scale 0.6
 *   - Resulting world feet Y · world head Y
 *   - Sand disc top (Y=0.66) + bottom (Y=-0.36) for comparison
 *   - Required delta to put feet at sand top
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

globalThis.self = globalThis

const URL =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/character-castaway-confused-scratch.glb"

console.log("→ fetching character GLB")
const res = await fetch(URL)
console.log("  HTTP", res.status, "·", res.headers.get("content-length"), "B")
const ab = await res.arrayBuffer()

const loader = new GLTFLoader()
const gltf = await new Promise((res, rej) => loader.parse(ab, "", res, rej))

console.log("\n=== CHARACTER GLB · LOCAL BBOX (scale 1.0) ===")
const localBox = new THREE.Box3().setFromObject(gltf.scene)
const localSize = new THREE.Vector3()
const localCenter = new THREE.Vector3()
localBox.getSize(localSize)
localBox.getCenter(localCenter)
console.log(`  size   = ${localSize.x.toFixed(3)} x ${localSize.y.toFixed(3)} x ${localSize.z.toFixed(3)}`)
console.log(`  center = (${localCenter.x.toFixed(3)}, ${localCenter.y.toFixed(3)}, ${localCenter.z.toFixed(3)})`)
console.log(`  min    = (${localBox.min.x.toFixed(3)}, ${localBox.min.y.toFixed(3)}, ${localBox.min.z.toFixed(3)})`)
console.log(`  max    = (${localBox.max.x.toFixed(3)}, ${localBox.max.y.toFixed(3)}, ${localBox.max.z.toFixed(3)})`)
console.log(`  → local feet Y (min.y) = ${localBox.min.y.toFixed(3)}`)
console.log(`  → local head Y (max.y) = ${localBox.max.y.toFixed(3)}`)
console.log(`  → local height         = ${localSize.y.toFixed(3)}`)

console.log("\n=== AFTER SCALE 0.6 ===")
const scaled = localBox.clone()
scaled.min.multiplyScalar(0.6)
scaled.max.multiplyScalar(0.6)
const scaledSize = new THREE.Vector3()
scaled.getSize(scaledSize)
console.log(`  size   = ${scaledSize.x.toFixed(3)} x ${scaledSize.y.toFixed(3)} x ${scaledSize.z.toFixed(3)}`)
console.log(`  feet Y = ${scaled.min.y.toFixed(3)}`)
console.log(`  head Y = ${scaled.max.y.toFixed(3)}`)

console.log("\n=== WORLD PLACEMENT (current Scene.tsx) ===")
console.log("  Outer group position [0, 0.05, 0]")
console.log("  CharacterModel position [-0.1, 0, 0.3] · scale 0.6")
console.log("  → combined Y offset = 0.05 + 0 = 0.05")

const currentWorldFeet = scaled.min.y + 0.05
const currentWorldHead = scaled.max.y + 0.05
console.log(`  → world feet Y = ${currentWorldFeet.toFixed(3)}`)
console.log(`  → world head Y = ${currentWorldHead.toFixed(3)}`)

console.log("\n=== SAND REFERENCE ===")
console.log("  Island_0 / Object_4 (sand disc) world Y range:")
console.log("    bottom = -0.36")
console.log("    top    =  0.66")
console.log("  Ocean001_57 plane (post Round 13) Y = -0.40")

console.log("\n=== TARGETS · FEET TOUCHING SAND TOP (Y=0.66) ===")
const delta = 0.66 - currentWorldFeet
console.log(`  Required Y bump = 0.66 - ${currentWorldFeet.toFixed(3)} = ${delta.toFixed(3)}`)
console.log(`  → New outer group Y = 0.05 + ${delta.toFixed(3)} = ${(0.05 + delta).toFixed(3)}`)

console.log("\n=== ALT TARGETS ===")
const sandTopY = 0.66
const sandMidY = 0.15 // center of sand disc
for (const targetFeetY of [sandTopY, sandMidY, sandTopY - 0.05, sandTopY + 0.02]) {
  const bumpedFeet = targetFeetY
  const groupY = bumpedFeet - scaled.min.y
  console.log(`  target feet Y=${targetFeetY.toFixed(3)} → group Y=${groupY.toFixed(3)}`)
}

console.log("\n=== ASSESSMENT ===")
if (currentWorldFeet < 0.66 - 0.05) {
  const buryDepth = 0.66 - currentWorldFeet
  console.log(`  ✗ Character feet at Y=${currentWorldFeet.toFixed(3)} · sand top at Y=0.66`)
  console.log(`  ✗ Character is BURIED ${buryDepth.toFixed(3)}u below sand top`)
  console.log(`  ✗ Character height (scaled) = ${scaledSize.y.toFixed(3)}u · buried ratio = ${(buryDepth / scaledSize.y * 100).toFixed(1)}%`)
} else if (currentWorldFeet > 0.66 + 0.1) {
  console.log(`  ✗ Character FLOATING above sand · feet at Y=${currentWorldFeet.toFixed(3)} vs sand top Y=0.66`)
} else {
  console.log(`  ✓ Character feet within ±0.1u of sand top · acceptable`)
}
