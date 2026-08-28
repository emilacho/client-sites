/**
 * R96.40 · capture preview post Cowork V2 dispatch · isla 3D tweaks.
 * Camera default [9, 4, 0] · qa=1 freezes idle pulse/animation.
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const URL =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/?qa=1"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })
const out = join(dir, "r96-40-isla-3d.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
console.log("→", URL)
const r = await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 })
console.log("  HTTP:", r?.status())
// Wait extra · escena 3D needs additional time for GLBs to fully render
await page.waitForTimeout(6000)
await page.screenshot({ path: out, fullPage: false })
console.log("  📸 saved", out)
await browser.close()
