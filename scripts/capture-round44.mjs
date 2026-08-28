/**
 * Round 44 · capture default rotation + idle frame to verify the
 * 3 fallen cocos render in their new positions along the back-left
 * to central palm path. Hover frames are deferred to a separate
 * script after a magenta-cluster scan locates the exact pixels.
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const BASE =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})

// qa frozen baseline
{
  const page = await ctx.newPage()
  await page.goto(`${BASE}?qa=1`, { waitUntil: "networkidle", timeout: 60_000 })
  await page.waitForTimeout(2500)
  await page.screenshot({ path: join(dir, "round-44-idle.png") })
  console.log("📸 idle qa")
  await page.close()
}

// 4 rotation angles
{
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
  await page.waitForTimeout(2500)
  const angles = [0, 90, 180, 270]
  for (let i = 0; i < angles.length; i++) {
    if (i > 0) await page.waitForTimeout(15_000)
    const deg = angles[i]
    await page.screenshot({
      path: join(dir, `round-44-rot-${String(deg).padStart(3, "0")}.png`),
    })
    console.log(`📸 rot ${deg}°`)
  }
  await page.close()
}

await browser.close()
console.log("✓ done")
