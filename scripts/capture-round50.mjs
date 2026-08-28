/**
 * Round 50 · surfboard repositioned in front of back palm trunk.
 * Capture after the new deploy goes live.
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
    join(dir, `round-50-burn-${i + 1}.png`),
  )
  console.log(`  warm ${i + 1}/8`)
}

await captureOnce(`${BASE}?qa=1`, join(dir, "round-50-after.png"))
console.log("📸 round-50-after.png")

// One live drift frame at t=16s (proven render time slot)
const page = await ctx.newPage()
await page.goto(BASE, { waitUntil: "load", timeout: 60_000 })
await page.waitForTimeout(16_000)
await page.screenshot({ path: join(dir, "round-50-after-drift.png") })
console.log("📸 round-50-after-drift.png")
await page.close()

await browser.close()
