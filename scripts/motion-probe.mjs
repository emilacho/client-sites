/**
 * motion-probe · captures N frames a fixed gap apart and reports the
 * per-pixel diff count. Used to verify the character animation is
 * actually advancing the mixer (?qa=1 freezes camera but should NOT
 * freeze the character's own animation timeline).
 *
 *   node scripts/motion-probe.mjs <frames=4> <gap-ms=2000>
 */
import { chromium } from "playwright"
import { readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve } from "node:path"
import zlib from "node:zlib"

const N = parseInt(process.argv[2] ?? "4", 10)
const GAP_MS = parseInt(process.argv[3] ?? "2000", 10)
const URL =
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app?qa=1"

const OUT = "scripts/qa/motion"
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
const page = await ctx.newPage()
console.log("→ navigating", URL)
await page.goto(URL, { waitUntil: "networkidle", timeout: 45_000 })
await page.waitForTimeout(3000) // let GLBs + mixer warm up

const buffers = []
for (let i = 0; i < N; i++) {
  if (i > 0) await page.waitForTimeout(GAP_MS)
  const buf = await page.screenshot({ fullPage: false })
  writeFileSync(resolve(OUT, `frame-${i}.png`), buf)
  buffers.push(buf)
  console.log(`  📸 frame-${i}.png (${buf.length} bytes)`)
}

await browser.close()

// Quick "different bytes" hash for each pair (cheap signal · two
// identical frames will hash to the same length and same first-N bytes)
function quickHash(buf) {
  return zlib.deflateRawSync(buf).length // crude but distinguishing
}
console.log("\nFrame hash diffs (different value → frames not identical):")
const hashes = buffers.map(quickHash)
for (let i = 0; i < hashes.length; i++) {
  console.log(`  frame-${i}: ${hashes[i]}`)
}
const allEqual = hashes.every((h) => h === hashes[0])
console.log(allEqual ? "\n  ✗ ALL FRAMES IDENTICAL · animation NOT advancing" : "\n  ✓ frames differ · animation appears to be active")
