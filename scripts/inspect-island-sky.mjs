/**
 * Round 11 forensic · inspect island-low-poly.glb scene tree.
 *
 * Walks every Object3D in the parsed GLB and prints:
 *   - name · type · visible · castShadow · receiveShadow
 *   - position · scale · world-space bbox (for meshes)
 *   - material type · side · transparent · depthWrite · opacity
 *   - any embedded HDRI / EXR (extensionsUsed · `KHR_environment_map`)
 *   - layers mask
 *
 * Then highlights candidates that match sky/skybox/dome/background
 * naming heuristics, plus any mesh with bbox span > 30 units (likely
 * a dome / large background plane).
 */
import { readFileSync } from "node:fs"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

globalThis.self = globalThis
globalThis.URL = globalThis.URL || class URL {}

const URL_GLB =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/island-low-poly.glb"

console.log("→ fetching", URL_GLB)
const res = await fetch(URL_GLB)
console.log("  HTTP", res.status, "·", res.headers.get("content-length"), "B")
const ab = await res.arrayBuffer()

const loader = new GLTFLoader()
const gltf = await new Promise((resolve, reject) => {
  loader.parse(ab, "", resolve, reject)
})

console.log("\n=== EXTENSIONS / METADATA ===")
console.log("  extensionsUsed     :", gltf.parser?.json?.extensionsUsed ?? "(none)")
console.log("  extensionsRequired :", gltf.parser?.json?.extensionsRequired ?? "(none)")
console.log("  asset.generator    :", gltf.parser?.json?.asset?.generator ?? "(?)")
console.log("  asset.version      :", gltf.parser?.json?.asset?.version ?? "(?)")
console.log("  scenes             :", gltf.scenes?.length)
console.log("  animations         :", gltf.animations?.length)
console.log("  cameras            :", gltf.cameras?.length)

console.log("\n=== SCENE TREE ===")
const SKY_NAME_RE = /sky|skybox|dome|background|backdrop|environment|atmosphere|cloud|cielo|fondo/i

let depth = 0
const candidates = []
gltf.scene.traverse((obj) => {
  // Indent by computing depth from root
  let d = 0
  let p = obj
  while (p.parent && p !== gltf.scene) {
    p = p.parent
    d++
  }
  const indent = "  ".repeat(d)
  const isMesh = obj.isMesh === true
  const isSkinned = obj.isSkinnedMesh === true
  const tag = isSkinned ? "SkinnedMesh" : isMesh ? "Mesh" : obj.type
  const bits = [
    `${indent}- ${obj.name || "(unnamed)"}`,
    `[${tag}]`,
    obj.visible === false ? "HIDDEN" : "vis✓",
    `scale=${obj.scale.x.toFixed(2)},${obj.scale.y.toFixed(2)},${obj.scale.z.toFixed(2)}`,
    `pos=${obj.position.x.toFixed(2)},${obj.position.y.toFixed(2)},${obj.position.z.toFixed(2)}`,
  ]
  if (isMesh && !isSkinned) {
    const bbox = new THREE.Box3().setFromObject(obj)
    const size = new THREE.Vector3()
    bbox.getSize(size)
    bits.push(`bbox=${size.x.toFixed(2)}x${size.y.toFixed(2)}x${size.z.toFixed(2)}`)
    const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material
    if (mat) {
      bits.push(
        `mat=${mat.type}`,
        `side=${["F","B","D"][mat.side ?? 0]}`,
        mat.transparent ? "transp" : "opaque",
        `dW=${mat.depthWrite}`,
        `op=${(mat.opacity ?? 1).toFixed(2)}`,
      )
      if (mat.emissive) {
        bits.push(`emissive=#${mat.emissive.getHexString()}`)
      }
      if (mat.color) {
        bits.push(`color=#${mat.color.getHexString()}`)
      }
    }
    const span = Math.max(size.x, size.y, size.z)
    if (span > 30 || SKY_NAME_RE.test(obj.name || "")) {
      candidates.push({ obj, size, mat, span })
    }
  }
  console.log(bits.join(" · "))
})

console.log("\n=== CAMERAS ===")
if (gltf.cameras?.length) {
  gltf.cameras.forEach((c, i) => {
    console.log(`  [${i}] ${c.type} · name="${c.name}" · near=${c.near} far=${c.far} fov=${c.fov || "(ortho)"}`)
  })
} else {
  console.log("  (no cameras embedded)")
}

console.log("\n=== EMBEDDED ENVIRONMENT / TEXTURES ===")
const j = gltf.parser?.json
if (j) {
  console.log("  textures        :", j.textures?.length ?? 0)
  console.log("  images          :", j.images?.length ?? 0)
  if (j.extensions) {
    console.log("  scene.extensions:", Object.keys(j.extensions))
  }
  // Look for any extension hint that the GLB ships an HDRI / env map
  const sceneJson = j.scenes?.[j.scene ?? 0]
  if (sceneJson?.extensions) {
    console.log("  scene[0].ext    :", Object.keys(sceneJson.extensions))
  }
}

console.log("\n=== SKY / SKYBOX CANDIDATES ===")
if (candidates.length === 0) {
  console.log("  (none · no mesh with sky-ish name AND no mesh with span > 30u)")
} else {
  for (const c of candidates) {
    console.log(`  • ${c.obj.name} · span=${c.span.toFixed(2)}u · vis=${c.obj.visible} · mat=${c.mat?.type}`)
    console.log(`      size=${c.size.x.toFixed(2)}x${c.size.y.toFixed(2)}x${c.size.z.toFixed(2)}`)
    console.log(`      side=${["FrontSide","BackSide","DoubleSide"][c.mat?.side ?? 0]}`)
    if (c.mat?.color) console.log(`      color=#${c.mat.color.getHexString()}`)
    console.log(`      depthWrite=${c.mat?.depthWrite} · depthTest=${c.mat?.depthTest} · transparent=${c.mat?.transparent}`)
  }
}

console.log("\n=== TOP-LEVEL BBOX (whole island) ===")
const wholeBbox = new THREE.Box3().setFromObject(gltf.scene)
const wholeSize = new THREE.Vector3()
wholeBbox.getSize(wholeSize)
console.log(`  size=${wholeSize.x.toFixed(2)} x ${wholeSize.y.toFixed(2)} x ${wholeSize.z.toFixed(2)}`)
console.log(`  min=${wholeBbox.min.x.toFixed(2)},${wholeBbox.min.y.toFixed(2)},${wholeBbox.min.z.toFixed(2)}`)
console.log(`  max=${wholeBbox.max.x.toFixed(2)},${wholeBbox.max.y.toFixed(2)},${wholeBbox.max.z.toFixed(2)}`)

console.log("\n✓ done")
