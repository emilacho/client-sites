/**
 * Compute the world-space bounding box of the Island_0 sand disc after
 * the Sketchfab root transform · gives the actual half-extents in X/Z
 * so we can place sign + surfboard safely within them.
 */
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

globalThis.self = globalThis

const BASE =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models"

const FILES = {
  island: { url: `${BASE}/island-low-poly.glb`, scale: 1 },
  sign: { url: `${BASE}/sign-naufrago.glb`, scale: 1 },
  surfboard: { url: `${BASE}/surfboard-old.glb`, scale: 0.7 },
}

for (const [name, { url, scale }] of Object.entries(FILES)) {
  const ab = await (await fetch(url)).arrayBuffer()
  const gltf = await new Promise((res, rej) =>
    new GLTFLoader().parse(ab, "", res, rej),
  )
  gltf.scene.scale.setScalar(scale)
  gltf.scene.updateMatrixWorld(true)
  console.log(`\n=== ${name} (scale=${scale}) ===`)
  if (name === "island") {
    for (const child of ["Island_0", "Chest_14", "Boat_15"]) {
      const obj = gltf.scene.getObjectByName(child)
      if (!obj) continue
      const b = new THREE.Box3().setFromObject(obj)
      const s = b.getSize(new THREE.Vector3())
      const c = b.getCenter(new THREE.Vector3())
      console.log(`  ${child} · center=[${c.toArray().map(v=>v.toFixed(2))}] · size=[${s.toArray().map(v=>v.toFixed(2))}] · X[${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)}] · Z[${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)}]`)
    }
  } else {
    const b = new THREE.Box3().setFromObject(gltf.scene)
    const s = b.getSize(new THREE.Vector3())
    const c = b.getCenter(new THREE.Vector3())
    console.log(`  world bbox · center=[${c.toArray().map(v=>v.toFixed(2))}] · size=[${s.toArray().map(v=>v.toFixed(2))}]`)
    console.log(`  X[${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)}] · Y[${b.min.y.toFixed(2)}..${b.max.y.toFixed(2)}] · Z[${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)}]`)
  }
}
