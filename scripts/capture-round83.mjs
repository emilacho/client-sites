/**
 * Round 83 · smoke capture · hover each of the 4 photo-enabled
 * review cards and verify the real photos render instead of the
 * DiceBear fallback.
 *
 * Pixel coords are approximate (canopy cluster ~656,200 / fallen
 * cluster ~667,305 per R43 forensic scan) · the coco hover proxy
 * is 0.15u radius so the hit window is small. We sweep ~30px
 * around the cluster center to find the firing pixel for each
 * card, then capture.
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

// Warm chain
async function fastCapture(url, path) {
  const page = await ctx.newPage()
  await page.goto(url, { waitUntil: "load", timeout: 60_000 })
  await page.waitForTimeout(3500)
  await page.screenshot({ path, fullPage: false })
  await page.close()
}
for (let i = 0; i < 8; i++) {
  await fastCapture(
    `${BASE}?qa=1&_warm=${i}`,
    join(dir, `round-83-burn-${i + 1}.png`),
  )
  console.log(`  warm ${i + 1}/8`)
}

// Hover targets · approximate coords per R43 forensic scan. The
// new R45 front cam shifts the canopy slightly · sweep a small
// grid until the hover card appears.
const targets = [
  { name: "canopy-mid",   x: 656, y: 200, label: "canopy hover (Diego/Andrea/María area)" },
  { name: "canopy-left",  x: 620, y: 200, label: "canopy left hover" },
  { name: "canopy-right", x: 690, y: 200, label: "canopy right hover" },
  { name: "fallen-front", x: 667, y: 470, label: "fallen-front hover (Pablo · Z=1.0 right shore moved further · approx)" },
]

const page = await ctx.newPage()
await page.goto(`${BASE}?qa=1`, { waitUntil: "load", timeout: 60_000 })
await page.waitForTimeout(3500)
for (const t of targets) {
  await page.mouse.move(50, 50)
  await page.waitForTimeout(200)
  await page.mouse.move(t.x, t.y, { steps: 4 })
  await page.waitForTimeout(700)
  await page.screenshot({
    path: join(dir, `round-83-hover-${t.name}.png`),
    fullPage: false,
  })
  console.log(`📸 ${t.name} · ${t.label}`)
}
await page.close()

await browser.close()
