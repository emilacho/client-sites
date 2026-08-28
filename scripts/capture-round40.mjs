/**
 * Round 40 · capture coconut hover state by programmatically
 * dispatching pointer events at the screen-projected position of
 * each coconut. Falls back to a single idle frame if hover injection
 * fails.
 *
 * Outputs:
 *   round-40-idle.png                (no hover)
 *   round-40-hover-{1,2,3,4}.png     (one per coconut)
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
console.log("→", BASE)
const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
console.log("  HTTP:", r?.status())
await page.waitForTimeout(3000)

// Idle baseline
await page.screenshot({ path: join(dir, "round-40-idle.png"), fullPage: false })
console.log("  📸 idle")

// Programmatically click positions in screen-space that roughly
// correspond to each coconut. Default cam at [9, 4, 0] looking
// origin · qa=1 freezes the camera. Use approximate screen positions
// of each coconut based on the perspective projection.
// Empirical positions for the 4 hover-proxy targets.
// Canopy cluster: derived from the cyan-cluster scan of the diagnostic
//   frame · 3 proxies merged at X[615..700] Y[160..251] (offset 0.2u).
// Fallen coconut: proxy now at world Y=0.66 (offset 0.6 to clear sand).
//   Reverse-projecting that point from the visible diagnostic puts
//   it around (~640, 410). The "left side" (248, 489) cluster
//   from the first scan was a sky/water false positive · ignore.
const screenTargets = [
  { name: "Coconut_3_4 (canopy · left)", x: 625, y: 200 },
  { name: "Coconut_1_3 (canopy · mid)", x: 655, y: 200 },
  { name: "Coconut_2_5 (canopy · right)", x: 685, y: 200 },
  { name: "Coconut_10_43 (fallen · proxy lifted to Y=0.66)", x: 641, y: 319 },
]

for (let i = 0; i < screenTargets.length; i++) {
  const t = screenTargets[i]
  console.log(`  → hover ${t.name} at (${t.x}, ${t.y})`)
  await page.mouse.move(t.x, t.y, { steps: 5 })
  // Settle for framer fade-in (200ms) + a bit
  await page.waitForTimeout(400)
  await page.screenshot({
    path: join(dir, `round-40-hover-${i + 1}.png`),
    fullPage: false,
  })
  console.log(`  📸 hover-${i + 1}`)
  // Move pointer off-island before next test so the previous card
  // dismisses
  await page.mouse.move(100, 100)
  await page.waitForTimeout(300)
}

await browser.close()
console.log("✓ done")
