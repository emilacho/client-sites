/**
 * Round 43 · verify tighter proxy radius.
 *   - 1 idle frame (no hover)
 *   - 4 hover-IN frames (cursor at proxy center · card should fire)
 *   - 4 hover-OUT frames (cursor +25px off proxy · card should NOT fire)
 *
 * Empirical proxy pixel positions (from R40 cluster scan / magenta diag):
 *   canopy cluster · center ≈ (656, 200)
 *   fallen proxy   · center ≈ (641, 319)
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const BASE =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/?qa=1"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
await page.waitForTimeout(3000)

// idle
await page.mouse.move(50, 50)
await page.waitForTimeout(300)
await page.screenshot({ path: join(dir, "round-43-idle.png") })
console.log("📸 idle")

const targets = [
  { name: "canopy-left",   inX: 625, inY: 200, outX: 565, outY: 200 },
  { name: "canopy-mid",    inX: 655, inY: 200, outX: 655, outY: 140 },
  { name: "canopy-right",  inX: 685, inY: 200, outX: 745, outY: 200 },
  { name: "fallen-coconut",inX: 667, inY: 305, outX: 700, outY: 305 },
]

for (let i = 0; i < targets.length; i++) {
  const t = targets[i]
  // HOVER IN
  await page.mouse.move(50, 50)
  await page.waitForTimeout(200)
  await page.mouse.move(t.inX, t.inY, { steps: 4 })
  await page.waitForTimeout(400)
  await page.screenshot({
    path: join(dir, `round-43-hover-in-${i + 1}-${t.name}.png`),
  })
  console.log(`📸 hover-in ${t.name} (${t.inX}, ${t.inY})`)

  // HOVER OUT (just off proxy)
  await page.mouse.move(50, 50)
  await page.waitForTimeout(200)
  await page.mouse.move(t.outX, t.outY, { steps: 4 })
  await page.waitForTimeout(400)
  await page.screenshot({
    path: join(dir, `round-43-hover-out-${i + 1}-${t.name}.png`),
  })
  console.log(`📸 hover-out ${t.name} (${t.outX}, ${t.outY})`)
}

await browser.close()
console.log("✓ done")
