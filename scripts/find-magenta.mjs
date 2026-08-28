import { readFileSync } from "node:fs"
import { PNG } from "pngjs"

const path = process.argv[2] || "scripts/qa/round-40-diag-fallen-magenta.png"
const png = PNG.sync.read(readFileSync(path))
console.log(`Image: ${png.width} × ${png.height}`)

// Magenta #ff00ff at 60% opacity over various bg
const pixels = []
for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const i = (png.width * y + x) * 4
    const r = png.data[i],
      g = png.data[i + 1],
      b = png.data[i + 2]
    // Magenta · high R, high B, low G
    if (r > 150 && b > 150 && g < 100) {
      pixels.push({ x, y })
    }
  }
}
console.log(`magenta-ish pixels: ${pixels.length}`)

const visited = new Set()
const clusters = []
for (const p of pixels) {
  const k = `${p.x},${p.y}`
  if (visited.has(k)) continue
  const c = []
  const q = [p]
  while (q.length) {
    const cur = q.shift()
    const ck = `${cur.x},${cur.y}`
    if (visited.has(ck)) continue
    visited.add(ck)
    c.push(cur)
    for (const n of pixels) {
      if (visited.has(`${n.x},${n.y}`)) continue
      if (Math.abs(n.x - cur.x) < 6 && Math.abs(n.y - cur.y) < 6) q.push(n)
    }
  }
  if (c.length > 20) clusters.push(c)
}

for (const c of clusters) {
  const cx = Math.round(c.reduce((s, p) => s + p.x, 0) / c.length)
  const cy = Math.round(c.reduce((s, p) => s + p.y, 0) / c.length)
  const minX = Math.min(...c.map((p) => p.x))
  const maxX = Math.max(...c.map((p) => p.x))
  const minY = Math.min(...c.map((p) => p.y))
  const maxY = Math.max(...c.map((p) => p.y))
  console.log(
    `  center=(${cx}, ${cy})  bounds=X[${minX}..${maxX}] Y[${minY}..${maxY}]  pixels=${c.length}`,
  )
}
