/**
 * Probe Chest_14 internals · list every child mesh and its
 * world-space bbox so we can identify the LID sub-mesh and find
 * its hinge axis. Needed for the R80 in-scene chest-opening
 * animation.
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

globalThis.self = globalThis

const URL =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/island-low-poly.glb"

const ab = await (await fetch(URL)).arrayBuffer()
const gltf = await new Promise((res, rej) =>
  new GLTFLoader().parse(ab, "", res, rej),
)
gltf.scene.updateMatrixWorld(true)

const chest = gltf.scene.getObjectByName("Chest_14")
if (!chest) {
  console.error("Chest_14 not found")
  process.exit(2)
}

console.log("== Chest_14 hierarchy ==")
function walk(obj, depth = 0) {
  const indent = "  ".repeat(depth)
  const b = new THREE.Box3().setFromObject(obj)
  const s = b.getSize(new THREE.Vector3())
  const c = b.getCenter(new THREE.Vector3())
  const t = obj.type
  const childCount = obj.children?.length ?? 0
  console.log(
    `${indent}- ${obj.name || "(unnamed)"} [${t}] children=${childCount}`,
  )
  if (s.x > 0 && Number.isFinite(s.x)) {
    console.log(
      `${indent}  bbox · center=[${c.toArray().map((v) => v.toFixed(2))}] · size=[${s.toArray().map((v) => v.toFixed(2))}]`,
    )
  }
  for (const child of obj.children ?? []) walk(child, depth + 1)
}
walk(chest)
