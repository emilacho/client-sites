/**
 * Round 33rrr · capture 4 annotated frames at default cam
 * rotation 0/90/180/270 with the temporary TrunkLabels visible.
 * No qa=1 because we want the live camera + drei <Html> to render.
 *
 * Outputs:
 *   round-33rrr-annotated-{000,090,180,270}.png
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
const page = await ctx.newPage()
console.log("→", BASE)
const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
console.log("  HTTP:", r?.status())
await page.waitForTimeout(2500)
const angles = [0, 90, 180, 270]
for (let i = 0; i < angles.length; i++) {
  if (i > 0) await page.waitForTimeout(15_000)
  const deg = angles[i]
  const p = join(dir, `round-33rrr-annotated-${String(deg).padStart(3, "0")}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 rot ${deg}°`, p)
}
await browser.close()
console.log("✓ done")
