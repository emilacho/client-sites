/**
 * R46 final · "after" captures from the new production deploy
 * (commit 7ba50ad · rotation Y = Math.PI / 2 hardcoded · temp
 * override removed).
 *
 *   - 1 frame at ?qa=1 (drift paused) · primary after-shot
 *   - 4 frames across the R45 drift cycle (live, no qa=1) ·
 *     t = 0, 5s, 10s, 15s · samples one half of the X/Z period.
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

// Warm chain · single-capture cold starts produce black canvases.
// 8 warm navigations bring the chrome WebGL pipeline up before the
// real captures.
async function captureOnce(url, path, waitMs = 3500) {
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: "load", timeout: 60_000 })
  await page.waitForTimeout(waitMs)
  await page.screenshot({ path, fullPage: false })
  await page.close()
}

for (let i = 0; i < 8; i++) {
  await captureOnce(
    `${BASE}?qa=1&_warm=${i}`,
    join(dir, `round-46-after-burn-${i + 1}.png`),
  )
  console.log(`  warm ${i + 1}/8`)
}

// Primary "after" capture · qa=1, drift paused, final rotation.
await captureOnce(`${BASE}?qa=1`, join(dir, "round-46-final-after.png"))
console.log("📸 round-46-final-after.png")

// 4 drift cycle frames · live mode (no qa=1) so CameraRig.drift fires.
//   x/z period = 2π / 0.2 ≈ 31.4s · sampling t=0,5,10,15 covers
//   roughly half the cycle and captures the elliptical hover sweep.
{
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: "load", timeout: 60_000 })
  await page.waitForTimeout(2500)
  const samples = [0, 5000, 10000, 15000]
  const start = Date.now()
  for (let i = 0; i < samples.length; i++) {
    const due = start + samples[i]
    const wait = Math.max(0, due - Date.now())
    if (wait > 0) await page.waitForTimeout(wait)
    const p = join(
      dir,
      `round-46-final-drift-t${String(samples[i]).padStart(5, "0")}.png`,
    )
    await page.screenshot({ path: p, fullPage: false })
    console.log(`📸 drift t+${samples[i]}ms`)
  }
  await page.close()
}

await browser.close()
