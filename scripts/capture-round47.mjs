/**
 * Round 47 · cofre hover proxy radius 0.55 → 0.15 evidence.
 *
 * The hover proxy is invisible, so the visual "before vs after"
 * is whether a hover at a given pixel triggers the cofre pulse /
 * panel. With the old 0.55 radius, hover at the cofre center +
 * a generous off-edge both fire. With the new 0.15 radius, only
 * hover at the cofre body itself fires.
 *
 *   Frame 1 · hover at cofre center · expected fire in both
 *   Frame 2 · hover at "+50px off cofre" · BEFORE fired, AFTER no
 *   Frame 3 · idle baseline (cursor at 50,50)
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const BASE =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--disable-blink-features=AutomationControlled",
    "--use-gl=desktop",
    "--enable-gpu",
  ],
})
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
})
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined })
})

// Warm chain · 8 burns + real captures.
async function captureOnce(url, path, hoverFn) {
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: "load", timeout: 60_000 })
  await page.waitForTimeout(3500)
  if (hoverFn) await hoverFn(page)
  await page.screenshot({ path, fullPage: false })
  await page.close()
}

for (let i = 0; i < 8; i++) {
  await captureOnce(
    `${BASE}?qa=1&_warm=${i}`,
    join(dir, `round-47-burn-${i + 1}.png`),
  )
  console.log(`  warm ${i + 1}/8`)
}

// Empirical cofre center pixel from prior R34/R39 captures · roughly
// the chest in the middle-right of the island view.
//   cofre center ≈ (745, 425) for the front cam
//   off-edge probe ≈ (820, 425) · 75px right of cofre
const COFRE_CENTER = { x: 745, y: 425 }
const COFRE_OFF = { x: 820, y: 425 }

await captureOnce(BASE, join(dir, "round-47-idle.png"), async (page) => {
  await page.mouse.move(50, 50)
  await page.waitForTimeout(400)
})
console.log("📸 round-47-idle.png")

await captureOnce(BASE, join(dir, "round-47-hover-cofre.png"), async (page) => {
  await page.mouse.move(50, 50)
  await page.waitForTimeout(200)
  await page.mouse.move(COFRE_CENTER.x, COFRE_CENTER.y, { steps: 4 })
  await page.waitForTimeout(500)
})
console.log("📸 round-47-hover-cofre.png")

await captureOnce(BASE, join(dir, "round-47-hover-off.png"), async (page) => {
  await page.mouse.move(50, 50)
  await page.waitForTimeout(200)
  await page.mouse.move(COFRE_OFF.x, COFRE_OFF.y, { steps: 4 })
  await page.waitForTimeout(500)
})
console.log("📸 round-47-hover-off.png")

await browser.close()
