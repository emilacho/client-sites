/**
 * Scan a PNG for cyan-ish pixels and report cluster centers.
 * Used to locate visible debug proxies in the Round 40 frame.
 */
import { readFileSync } from "node:fs"
import { PNG } from "pngjs"

const path =
  process.argv[2] ||
  "scripts/qa/round-40-diag-visible-proxies.png"
const buf = readFileSync(path)
const png = PNG.sync.read(buf)

console.log(`Image: ${png.width} × ${png.height}`)

// Find cyan pixels: R<120, G>150, B>150, |G-B|<50
const cyanPixels = []
for (let y = 0; y < png.height; y++) {
  for (let x = 0; x < png.width; x++) {
    const idx = (png.width * y + x) * 4
    const r = png.data[idx]
    const g = png.data[idx + 1]
    const b = png.data[idx + 2]
    // Proxy is rgba(77, 212, 216) * opacity 0.4 over varying bg ·
    // result has R~50-120, G~180-220, B~180-225, G≈B (cyan signature).
    if (r < 100 && g > 180 && b > 180 && Math.abs(g - b) < 15) {
      cyanPixels.push({ x, y })
    }
  }
}
console.log(`Cyan pixels found: ${cyanPixels.length}`)

// Cluster via simple BFS · same-cluster if within 15px of any neighbor
const visited = new Set()
const clusters = []
for (const p of cyanPixels) {
  const key = `${p.x},${p.y}`
  if (visited.has(key)) continue
  const cluster = []
  const queue = [p]
  while (queue.length) {
    const cur = queue.shift()
    const k = `${cur.x},${cur.y}`
    if (visited.has(k)) continue
    visited.add(k)
    cluster.push(cur)
    for (const n of cyanPixels) {
      const nk = `${n.x},${n.y}`
      if (visited.has(nk)) continue
      if (Math.abs(n.x - cur.x) < 8 && Math.abs(n.y - cur.y) < 8) {
        queue.push(n)
      }
    }
  }
  if (cluster.length > 20) clusters.push(cluster)
}

console.log(`\nClusters (size > 20):`)
for (const c of clusters) {
  const cx = c.reduce((s, p) => s + p.x, 0) / c.length
  const cy = c.reduce((s, p) => s + p.y, 0) / c.length
  const minX = Math.min(...c.map((p) => p.x))
  const maxX = Math.max(...c.map((p) => p.x))
  const minY = Math.min(...c.map((p) => p.y))
  const maxY = Math.max(...c.map((p) => p.y))
  console.log(
    `  center=(${Math.round(cx)}, ${Math.round(cy)})  bounds=X[${minX}..${maxX}] Y[${minY}..${maxY}]  pixels=${c.length}`,
  )
}
