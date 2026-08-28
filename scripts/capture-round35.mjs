/**
 * Round 35 · before/after capture for TV-news ticker refactor.
 *   --phase=before captures the live single-band Bebas Neue ticker
 *   --phase=after  captures the new 3-band TV-news layout
 *
 * Also produces:
 *   round-35-before-after.png  side-by-side combo
 *   round-35-detail-zoom.png   bottom-strip close-up (after only)
 */
import { chromium } from "playwright"
import { mkdirSync, readFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)=(.+)$/)
    return m ? [m[1], m[2]] : [a.replace(/^--/, ""), "true"]
  }),
)
const phase = args.phase || "before"
const URL =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/?qa=1"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })
const framePath = join(dir, `round-35-${phase}.png`)
const detailPath = join(dir, `round-35-detail-zoom-${phase}.png`)
const comboPath = join(dir, "round-35-before-after.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
console.log("→", URL)
const r = await page.goto(URL, { waitUntil: "networkidle", timeout: 60_000 })
console.log("  HTTP:", r?.status())
await page.waitForTimeout(2500)
await page.screenshot({ path: framePath, fullPage: false })
console.log("  📸 full", framePath)

// Crop the bottom 110px for the ticker detail
await page.screenshot({
  path: detailPath,
  clip: { x: 0, y: 690, width: 1280, height: 110 },
})
console.log("  📸 detail-zoom", detailPath)

if (phase === "after") {
  const beforePath = join(dir, "round-35-before.png")
  const beforeDetail = join(dir, "round-35-detail-zoom-before.png")
  if (existsSync(beforePath) && existsSync(beforeDetail)) {
    const fullBefore = readFileSync(beforePath).toString("base64")
    const fullAfter = readFileSync(framePath).toString("base64")
    const tickerBefore = readFileSync(beforeDetail).toString("base64")
    const tickerAfter = readFileSync(detailPath).toString("base64")
    const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;">
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 35 · before · single bebas neue scroll (r24)</div>
    <img src="data:image/png;base64,${fullBefore}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 35 · after · 3-band tv broadcast</div>
    <img src="data:image/png;base64,${fullAfter}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div style="grid-column:1/3;">
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#fafafa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">ticker detail · before (top) vs after (bottom)</div>
    <img src="data:image/png;base64,${tickerBefore}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;margin-bottom:6px;" />
    <img src="data:image/png;base64,${tickerAfter}"  style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
</div></body></html>`
    const comp = await ctx.newPage()
    await comp.setViewportSize({ width: 2580, height: 1300 })
    await comp.setContent(html)
    await comp.waitForLoadState("networkidle")
    await comp.screenshot({ path: comboPath, fullPage: true })
    console.log("  📸 combo", comboPath)
  }
}

await browser.close()
console.log("✓ done · phase=" + phase)
