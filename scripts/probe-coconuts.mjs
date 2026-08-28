/**
 * Round 38 forensic · audit all Coconut_* meshes post-Round-25 ·
 * record world position + bbox + propose visible/hidden status from
 * default cam [9, 4, 0] looking at origin.
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

// Apply Round 25 island drop (-0.4 to everything except exempt set)
const root = gltf.scene.getObjectByName("GLTF_SceneRootNode")
if (root) {
  const exempt = new Set(["Ocean001_57", "Cube_59", "Boat_15", "Oar_1_16", "Oar_2_17"])
  for (const child of root.children) {
    if (!exempt.has(child.name)) child.position.y -= 0.4
  }
}
gltf.scene.updateMatrixWorld(true)

const coconutNames = []
gltf.scene.traverse((obj) => {
  if (obj.name && obj.name.startsWith("Coconut_") && !obj.isMesh) {
    coconutNames.push(obj.name)
  }
})
coconutNames.sort((a, b) => {
  // Sort by index (e.g., Coconut_1_3 → 1, Coconut_10_43 → 10)
  const ai = parseInt(a.split("_")[1])
  const bi = parseInt(b.split("_")[1])
  return ai - bi
})

console.log(`=== ${coconutNames.length} coconut groups · post-Round-25 ===`)
console.log("(camera at [9, 4, 0] looking origin · forward ≈ -X · right ≈ -Z)")
console.log()
for (const name of coconutNames) {
  const obj = gltf.scene.getObjectByName(name)
  if (!obj) continue
  const bb = new THREE.Box3().setFromObject(obj)
  const center = new THREE.Vector3()
  const size = new THREE.Vector3()
  bb.getCenter(center)
  bb.getSize(size)
  const camDistX = 9 - center.x
  const tag =
    center.y > 1.0
      ? "high (palm canopy)"
      : center.y < 0.3
        ? "fallen (on sand)"
        : "mid-height"
  console.log(`  ${name.padEnd(16)} pos=(${center.x.toFixed(2).padStart(5)}, ${center.y.toFixed(2).padStart(5)}, ${center.z.toFixed(2).padStart(5)})  size=(${size.x.toFixed(2)},${size.y.toFixed(2)},${size.z.toFixed(2)})  scale=(${obj.scale.x.toFixed(2)})  camDistX=${camDistX.toFixed(1).padStart(5)}  ${tag}`)
}

// Group by palm cluster
console.log("\n=== Cluster grouping (by Z) ===")
const clusters = {
  "Central palm (Z ≈ -0.4)": [],
  "Right palm (Z ≈ -1.4)": [],
  "Back-left palm (Z ≈ -2.0)": [],
  "Fallen on sand": [],
}
for (const name of coconutNames) {
  const obj = gltf.scene.getObjectByName(name)
  const bb = new THREE.Box3().setFromObject(obj)
  const center = new THREE.Vector3()
  bb.getCenter(center)
  if (center.y < 0.3) clusters["Fallen on sand"].push(name)
  else if (center.z > -1.0) clusters["Central palm (Z ≈ -0.4)"].push(name)
  else if (center.z > -1.7) clusters["Right palm (Z ≈ -1.4)"].push(name)
  else clusters["Back-left palm (Z ≈ -2.0)"].push(name)
}
for (const [k, v] of Object.entries(clusters)) {
  console.log(`  ${k}: ${v.join(", ") || "(none)"}`)
}
