// Extract baseColor texture from sign GLB + sample pixels to find palette.
import sharp from "sharp"
import { writeFileSync } from "node:fs"

const URL =
  "https://ordaeyxvvvdqsznsecjx.supabase.co/storage/v1/object/public/client-websites/naufrago/3d-models/sign-naufrago-compact.glb"

console.log("Fetching GLB...")
const res = await fetch(URL)
const buf = Buffer.from(await res.arrayBuffer())

// GLB structure · 12-byte header + JSON chunk + BIN chunk
const jsonLen = buf.readUInt32LE(12)
const jsonStart = 20
const jsonBytes = buf.subarray(jsonStart, jsonStart + jsonLen)
const json = JSON.parse(jsonBytes.toString("utf8"))

// BIN chunk follows JSON chunk · 8-byte header (length + type)
const binChunkStart = jsonStart + jsonLen
const binLen = buf.readUInt32LE(binChunkStart)
const binStart = binChunkStart + 8
const binBytes = buf.subarray(binStart, binStart + binLen)

console.log(`JSON chunk · ${jsonLen} bytes`)
console.log(`BIN chunk · ${binLen} bytes`)
console.log(`Images · ${json.images?.length ?? 0}`)
console.log(`Textures · ${json.textures?.length ?? 0}`)

// Identify which texture is baseColor (used by the material)
const baseColorTexIdx =
  json.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture?.index ?? 0
const baseColorImgIdx = json.textures?.[baseColorTexIdx]?.source ?? 0
console.log(
  `baseColor texture idx · ${baseColorTexIdx} → image idx ${baseColorImgIdx}`,
)

const img = json.images[baseColorImgIdx]
console.log(`Image mime · ${img.mimeType}`)
const bv = json.bufferViews[img.bufferView]
console.log(`BufferView offset · ${bv.byteOffset} · length · ${bv.byteLength}`)

const imgBytes = binBytes.subarray(
  bv.byteOffset ?? 0,
  (bv.byteOffset ?? 0) + bv.byteLength,
)

const ext = img.mimeType === "image/png" ? "png" : "jpg"
const outFile = `scripts/qa/sign-baseColor.${ext}`
writeFileSync(outFile, imgBytes)
console.log(`Saved baseColor texture → ${outFile}`)

// Decode with sharp · get dimensions
const meta = await sharp(imgBytes).metadata()
console.log(`Image · ${meta.width}×${meta.height}`)

// Sample raw pixels at key locations
const raw = await sharp(imgBytes).raw().toBuffer({ resolveWithObject: true })
const { data, info } = raw
const w = info.width
const h = info.height
const channels = info.channels // 3 or 4
console.log(`Raw · ${w}×${h} channels=${channels}`)

function pixelAt(x, y) {
  const idx = (y * w + x) * channels
  return [data[idx], data[idx + 1], data[idx + 2]]
}
function toHex([r, g, b]) {
  return (
    "#" +
    [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")
  ).toUpperCase()
}

// Sample 25 points in 5x5 grid
console.log("\n=== Sample 5x5 grid ===")
for (let row = 0; row < 5; row++) {
  const y = Math.floor((row + 0.5) * (h / 5))
  const colors = []
  for (let col = 0; col < 5; col++) {
    const x = Math.floor((col + 0.5) * (w / 5))
    colors.push(toHex(pixelAt(x, y)))
  }
  console.log(`  row ${row}: ${colors.join("  ")}`)
}

// Dominant color analysis · bucket by quantized hue
const buckets = new Map()
const step = 8 // sample every 8 pixels for speed
for (let y = 0; y < h; y += step) {
  for (let x = 0; x < w; x += step) {
    const [r, g, b] = pixelAt(x, y)
    // Quantize to 32-step palette per channel
    const key = `${Math.floor(r / 32)}-${Math.floor(g / 32)}-${Math.floor(b / 32)}`
    if (!buckets.has(key)) {
      buckets.set(key, { count: 0, r: 0, g: 0, b: 0 })
    }
    const bk = buckets.get(key)
    bk.count++
    bk.r += r
    bk.g += g
    bk.b += b
  }
}

const sorted = [...buckets.values()]
  .map((bk) => ({
    r: Math.round(bk.r / bk.count),
    g: Math.round(bk.g / bk.count),
    b: Math.round(bk.b / bk.count),
    count: bk.count,
  }))
  .sort((a, b) => b.count - a.count)

console.log("\n=== Top 10 dominant colors ===")
for (const c of sorted.slice(0, 10)) {
  const hex = toHex([c.r, c.g, c.b])
  const pct = ((c.count / sorted.reduce((s, x) => s + x.count, 0)) * 100).toFixed(1)
  console.log(`  ${hex}  count=${c.count}  ${pct}%`)
}
