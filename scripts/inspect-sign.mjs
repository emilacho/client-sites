// Inspect sign GLB · descubre cuántas textures + meshes tiene · necesito
// saber cuál es la textura del texto "NÁUFRAGO" para poder reemplazarla.
const URL =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/sign-naufrago-compact.glb"

const res = await fetch(URL)
const buf = Buffer.from(await res.arrayBuffer())

// Parse GLB header · JSON chunk
const jsonLen = buf.readUInt32LE(12)
const jsonStart = 20
const jsonBytes = buf.subarray(jsonStart, jsonStart + jsonLen)
const json = JSON.parse(jsonBytes.toString("utf8"))

console.log("=== MATERIALS ===")
for (const m of json.materials ?? []) {
  const pbr = m.pbrMetallicRoughness ?? {}
  const c = pbr.baseColorFactor
  const cHex = c
    ? "#" +
      [c[0], c[1], c[2]]
        .map((v) => Math.round(v * 255).toString(16).padStart(2, "0"))
        .join("")
    : "(no factor)"
  const tex = pbr.baseColorTexture
    ? `tex#${pbr.baseColorTexture.index}`
    : "no-tex"
  console.log(`  "${m.name}" baseColor=${cHex} ${tex}`)
}

console.log("\n=== TEXTURES ===")
for (const t of json.textures ?? []) {
  const img = t.source !== undefined ? json.images?.[t.source] : null
  console.log(
    `  tex idx ${json.textures.indexOf(t)} → image "${img?.name ?? "?"}" mime=${img?.mimeType ?? "?"}`,
  )
}

console.log("\n=== MESHES → MATERIALS ===")
for (const mesh of json.meshes ?? []) {
  console.log(`  "${mesh.name}"`)
  for (const p of mesh.primitives ?? []) {
    const matIdx = p.material
    const matName =
      matIdx !== undefined ? json.materials[matIdx]?.name : "(none)"
    console.log(`    └ mat="${matName}"`)
  }
}

console.log("\n=== NODES (top-level) ===")
for (const n of json.nodes ?? []) {
  console.log(
    `  node "${n.name}" mesh=${n.mesh ?? "-"} translation=${JSON.stringify(n.translation ?? null)}`,
  )
}
