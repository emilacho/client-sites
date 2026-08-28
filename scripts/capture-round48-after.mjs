/**
 * Round 48 · capture AFTER frames with the new Y=0.06 fallen cocos.
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
    join(dir, `round-48-after-burn-${i + 1}.png`),
  )
  console.log(`  warm ${i + 1}/8`)
}

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
    `round-48-after-drift-t${String(samples[i]).padStart(5, "0")}.png`,
  )
  await page.screenshot({ path: p, fullPage: false })
  console.log(`📸 after t+${samples[i]}ms`)
}
await page.close()

await browser.close()
