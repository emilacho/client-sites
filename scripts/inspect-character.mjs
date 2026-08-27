// Parse GLB binary manually · extract JSON chunk · list materials + meshes.
const URL =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/character-castaway-confused-scratch-compact.glb"

const res = await fetch(URL)
const buf = Buffer.from(await res.arrayBuffer())

// GLB header: 12 bytes (magic, version, length)
// First chunk: 8 bytes (chunkLength, chunkType="JSON") + JSON bytes
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
  const tex = pbr.baseColorTexture ? "tex" : "no-tex"
  console.log(`  "${m.name}" baseColor=${cHex} ${tex}`)
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
