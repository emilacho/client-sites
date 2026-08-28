/**
 * R96.41 · capture preview a mayor resolución para verificar crab + botella visibles.
 * 1920×1080 viewport + DPR 2 para detalle.
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const URL =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/?qa=1"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })
const out = join(dir, "r96-41-isla-hires.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 2,
})
const page = await ctx.newPage()
console.log("→", URL)
const r = await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 })
console.log("  HTTP:", r?.status())
await page.waitForTimeout(8000)
await page.screenshot({ path: out, fullPage: false })
console.log("  📸 saved", out)
await browser.close()
