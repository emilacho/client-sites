import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"

const BASE = process.env.URL || "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const dir = resolve("tmp/landing-2026-08-24")
mkdirSync(dir, { recursive: true })

const browser = await chromium.launch()

// escritorio
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
const page = await ctx.newPage()
const res = await page.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
console.log("HTTP", res.status(), "·", page.url())
await page.waitForTimeout(4000)
console.log("TITLE:", await page.title())

const alto = await page.evaluate(() => document.body.scrollHeight)
console.log("alto total:", alto, "px")

await page.screenshot({ path: join(dir, "01-hero.png") })
// recorrido por pantallas
let n = 2
for (let y = 900; y < Math.min(alto, 9000); y += 850) {
  await page.evaluate((yy) => window.scrollTo(0, yy), y)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: join(dir, `${String(n).padStart(2,"0")}-y${y}.png`) })
  n++
}
await ctx.close()

// movil
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const mp = await m.newPage()
await mp.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
await mp.waitForTimeout(4000)
await mp.screenshot({ path: join(dir, "movil-01.png") })
await mp.evaluate(() => window.scrollTo(0, 900)); await mp.waitForTimeout(1000)
await mp.screenshot({ path: join(dir, "movil-02.png") })
await browser.close()
console.log("capturas en", dir)
