/**
 * Round 48 · verify the 3 R44 fallen cocos are visible from the
 * new R45 front cam [0, 4, 9].
 *
 * The fallen cocos sit at:
 *   X=-0.95, Z=-0.85, Y=-0.075
 *   X=-0.65, Z=-0.65, Y=-0.075
 *   X=-0.35, Z=-0.5,  Y=-0.075
 *
 * All on the back-left of the island, with Y=-0.075 (sand top is
 * at 0.26 · so they sit ~0.33u below sand top, partially buried as
 * per the R44 dispatch).
 *
 * 4 default-rotation frames with the drift cycle running so the
 * cam sweeps over the elliptical hover · if visible at any drift
 * phase, evidence delivered. If invisible across all 4, R48
 * recommends reposition.
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
    "--use-angle=default",
    "--enable-features=Vulkan,UseSkiaRenderer",
    "--ignore-gpu-blocklist",
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

// Warm chain · 8 burns at ?qa=1 (drift paused so warm finishes fast)
async function captureOnce(url, path) {
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: "load", timeout: 60_000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path, fullPage: false })
  await page.close()
}
for (let i = 0; i < 8; i++) {
  await captureOnce(
    `${BASE}?qa=1&_warm=${i}`,
    join(dir, `round-48-burn-${i + 1}.png`),
  )
  console.log(`  warm ${i + 1}/8`)
}

// 4 frames in live mode (no qa=1) sampling the X/Z drift cycle
//   period 2π/0.2 ≈ 31.4s · samples at t=0, 8, 16, 24s cover the
//   full cycle so any drift phase that exposes the back-left is
//   captured.
const samples = [0, 8000, 16000, 24000]
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: "load", timeout: 60_000 })
await page.waitForTimeout(3500)
const start = Date.now()
for (let i = 0; i < samples.length; i++) {
  const due = start + samples[i]
  const wait = Math.max(0, due - Date.now())
  if (wait > 0) await page.waitForTimeout(wait)
  const p = join(
    dir,
    `round-48-drift-t${String(samples[i]).padStart(5, "0")}.png`,
  )
  await page.screenshot({ path: p, fullPage: false })
  console.log(`📸 drift t+${samples[i]}ms`)
}
await page.close()

await browser.close()
