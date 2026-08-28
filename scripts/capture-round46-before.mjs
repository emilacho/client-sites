/**
 * R46 final · "before" capture using the proven warm-chain pattern
 * from capture-round46.mjs. Single-capture cold-start has consistently
 * produced black canvases, but a chain of ~9 navigations warms the
 * chrome WebGL pipeline enough for the final capture to render.
 *
 * Captures the R41 rotation (rotation Y = Math.PI + 0.3 ≈ 3.4416)
 * via ?surfRotY=3.4416 · same rotation that ships on the current
 * temp-override deploy when no surfRotY param is set.
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
  args: ["--disable-blink-features=AutomationControlled"],
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

// R41 rotation = Math.PI + 0.3 ≈ 3.4416 rad. Capturing via override
// to render the OLD rotation independent of what's currently on
// production (the deploy still has the temp override, so without
// the param the surf renders with R41 props anyway · but using the
// param explicitly is more durable in case prod is mid-deploy).
const TARGET_RAD = Math.PI + 0.3
const targetUrl = `${BASE}?qa=1&surfRotY=${TARGET_RAD}`
const outFile = join(dir, "round-46-final-before.png")

// Burn captures · the first 8 navigations warm the chrome WebGL
// pipeline. Their screenshots are written but unused; the 9th is
// the real capture.
const BURN_COUNT = 8
async function captureOnce(url, path) {
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: "load", timeout: 60_000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path, fullPage: false })
  await page.close()
}

for (let i = 0; i < BURN_COUNT; i++) {
  // Burn URLs use unique sentinel rotation Y values so they're
  // distinct from the real capture (no same-URL goto skip).
  const burnUrl = `${BASE}?qa=1&surfRotY=${-1 - i}`
  await captureOnce(burnUrl, join(dir, `round-46-burn-${i + 1}.png`))
  console.log(`  burn ${i + 1}/${BURN_COUNT}`)
}
await captureOnce(targetUrl, outFile)
console.log("📸", outFile)

await browser.close()
