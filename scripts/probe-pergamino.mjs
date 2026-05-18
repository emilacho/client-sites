/**
 * Probe the new pergamino-pirata GLB · world-space bbox + mesh
 * hierarchy + texture material count. Needed to decide scale,
 * orientation, and placement on the island sand.
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { readFileSync } from "node:fs"

globalThis.self = globalThis

const buf = readFileSync(
  "public/models/pergamino-pirata.glb",
)
const gltf = await new Promise((res, rej) =>
  new GLTFLoader().parse(
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    "",
    res,
    rej,
  ),
)
gltf.scene.updateMatrixWorld(true)

const root = gltf.scene
const box = new THREE.Box3().setFromObject(root)
const size = box.getSize(new THREE.Vector3())
const center = box.getCenter(new THREE.Vector3())

console.log("=== pergamino-pirata.glb ===")
console.log(`world bbox · center=[${center.toArray().map((v) => v.toFixed(3))}]`)
console.log(`            · size=[${size.toArray().map((v) => v.toFixed(3))}]`)
console.log(
  `X[${box.min.x.toFixed(2)}..${box.max.x.toFixed(2)}] · ` +
    `Y[${box.min.y.toFixed(2)}..${box.max.y.toFixed(2)}] · ` +
    `Z[${box.min.z.toFixed(2)}..${box.max.z.toFixed(2)}]`,
)

let meshCount = 0
let triCount = 0
const materials = new Set()
root.traverse((o) => {
  if (o.isMesh) {
    meshCount++
    const g = o.geometry
    if (g.index) triCount += g.index.count / 3
    else if (g.attributes.position) triCount += g.attributes.position.count / 3
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material]
      for (const m of mats) materials.add(m.name || m.uuid.slice(0, 8))
    }
  }
})
console.log(`meshes=${meshCount} · triangles=${Math.round(triCount)} · materials=${materials.size}`)
console.log("materials:", [...materials].join(", "))

// Hierarchy (depth 2)
function walk(o, d = 0) {
  if (d > 2) return
  const pad = "  ".repeat(d)
  console.log(
    `${pad}- ${o.name || "(unnamed)"} [${o.type}] children=${o.children.length}`,
  )
  for (const c of o.children) walk(c, d + 1)
}
walk(root)
