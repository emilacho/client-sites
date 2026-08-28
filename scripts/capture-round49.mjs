/**
 * Round 49 · coco taladro vibration live evidence.
 *
 * R42 set amplitude 0.04 + R39.1 quadratic decay over 0.9s. Static
 * screenshots have shown no visible motion, so this samples 8
 * frames at fast cadence to detect amplitude.
 *
 *   t = 0 / 0.15 / 0.3 / 0.45 / 0.6 / 0.75 / 0.9 / 1.05s
 *
 * Each coco runs on an independent phase (0-3s random offset +
 * ±1s interval jitter per the useMemo), so the 12 cocos at any
 * given moment are NOT in sync · we should see different cocos in
 * different burst states across the 8 frames.
 *
 * Live mode · NO ?qa=1 · so useFrame fires normally and the drift
 * cam runs. We snap viewport without changing cam so the cocos
 * stay roughly in the same pixel region for comparison.
 *
 * If frames all look identical · useFrame for coconuts is broken.
 * If frames differ subtly · R49 confirms vibration, suggests an
 * amplitude bump (0.04 → 0.06) for stronger visibility.
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
    join(dir, `round-49-burn-${i + 1}.png`),
  )
  console.log(`  warm ${i + 1}/8`)
}

// 8 timing frames · sample at 150ms cadence covering 1.05s · one
// full burst envelope (0.9s) plus a small overshoot. Live mode (no
// qa=1) so useFrame fires. Single page · stay on the same canvas
// instance so the per-coco phaseOffset is consistent across samples.
const samples = [0, 150, 300, 450, 600, 750, 900, 1050]
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
    `round-49-vib-t${String(samples[i]).padStart(4, "0")}.png`,
  )
  await page.screenshot({ path: p, fullPage: false })
  console.log(`📸 vib t+${samples[i]}ms`)
}
await page.close()

await browser.close()
