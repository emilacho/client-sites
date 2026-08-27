/**
 * Parse the 4 Náufrago GLBs against the local three@0.184 + GLTFLoader.
 * If the same "Invalid typed array length" error reproduces here, the
 * file is corrupt at the source. If they parse OK, the issue is in
 * the browser/network/loader pipeline · most likely Cloudflare range
 * caching or the dynamic-import-time preload.
 */
import { readFileSync } from "node:fs"
import * as path from "node:path"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"

// Provide DOM-ish polyfills three's GLTFLoader expects in non-browser env
globalThis.self = globalThis
globalThis.URL = globalThis.URL || class URL {}

const BASE =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models"
const FILES = [
  "island-low-poly-optimized.glb",
  "character-castaway-confused-scratch.glb",
  "sign-naufrago.glb",
  "surfboard-old.glb",
]

const loader = new GLTFLoader()

for (const f of FILES) {
  const url = `${BASE}/${f}`
  console.log(`\n— ${f} —`)
  try {
    const res = await fetch(url)
    console.log("  HTTP", res.status, "·", res.headers.get("content-type"), "·", res.headers.get("content-length"), "B")
    const ab = await res.arrayBuffer()
    console.log("  fetched", ab.byteLength, "bytes")
    await new Promise((resolve, reject) => {
      loader.parse(ab, "", (gltf) => {
        console.log("  ✓ parsed OK ·", gltf.scene.children.length, "root children")
        resolve(undefined)
      }, (err) => {
        console.log("  ✗ parse error:", err?.message ?? err)
        reject(err)
      })
    }).catch(() => {})
  } catch (e) {
    console.log("  ✗ fetch error:", e?.message ?? e)
  }
}
