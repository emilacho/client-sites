/**
 * Round 39.1 · 12-frame comparison · 6 frames around chest burst
 * window + 6 frames around a 0.9s span (to span one coco burst).
 *
 * Chest burst fires deterministically at t=0..0.4s (cyclePos < 0.4
 * for interval=3.0). Cocos bursts depend on random phaseOffset · we
 * can't predict timing across reloads, so we capture a longer span
 * to statistically catch at least one burst.
 *
 * Both rows are captured in the same page session at fine intervals
 * and composed into a 2-row × 6-col grid.
 */
import { chromium } from "playwright"
import { mkdirSync, readFileSync } from "node:fs"
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

// Chest burst window 0-0.4s · capture 6 frames every 0.07s
const chestTimes = [0, 70, 140, 210, 280, 350]
const cocoTimes = [0, 180, 360, 540, 720, 900]
const chestFrames = []
const cocoFrames = []

{
  const page = await ctx.newPage()
  console.log("→ chest window", BASE)
  const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
  console.log("  HTTP:", r?.status())
  await page.waitForTimeout(2000) // settle
  const startT = Date.now()
  for (let i = 0; i < chestTimes.length; i++) {
    const due = startT + chestTimes[i]
    const waitMs = Math.max(0, due - Date.now())
    if (waitMs > 0) await page.waitForTimeout(waitMs)
    const p = join(dir, `round-39-1-chest-t${String(chestTimes[i]).padStart(4, "0")}.png`)
    await page.screenshot({ path: p, fullPage: false })
    console.log(`  📸 chest t+${chestTimes[i]}ms`, p)
    chestFrames.push(p)
  }
  await page.close()
}

{
  const page = await ctx.newPage()
  console.log("→ coco window", BASE)
  const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
  console.log("  HTTP:", r?.status())
  await page.waitForTimeout(2000)
  const startT = Date.now()
  for (let i = 0; i < cocoTimes.length; i++) {
    const due = startT + cocoTimes[i]
    const waitMs = Math.max(0, due - Date.now())
    if (waitMs > 0) await page.waitForTimeout(waitMs)
    const p = join(dir, `round-39-1-coco-t${String(cocoTimes[i]).padStart(4, "0")}.png`)
    await page.screenshot({ path: p, fullPage: false })
    console.log(`  📸 coco t+${cocoTimes[i]}ms`, p)
    cocoFrames.push(p)
  }
  await page.close()
}

// 2x6 comparison grid
const chestB64 = chestFrames.map((p) => readFileSync(p).toString("base64"))
const cocoB64 = cocoFrames.map((p) => readFileSync(p).toString("base64"))
const cell = (label, color, b64) => `
  <div>
    <div style="padding:4px 8px;font-size:10px;font-family:ui-monospace,monospace;letter-spacing:.16em;color:${color};text-transform:uppercase;background:#1a1a24;border-radius:4px;margin-bottom:4px;text-align:center;">${label}</div>
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:6px;border:1px solid #2a2a35;" />
  </div>`
const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="padding:8px;">
  <div style="color:#fbbf24;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px;">Chest burst window · 0.4s · uniform ±0.05 rad</div>
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin-bottom:14px;">
    ${chestTimes.map((t, i) => cell(`chest · t=${t}ms`, "#fbbf24", chestB64[i])).join("")}
  </div>
  <div style="color:#67e8f9;font-family:ui-monospace,monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:8px;">Coco burst window · 0.9s · decay 0.02 → 0 (peak at start, quadratic)</div>
  <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;">
    ${cocoTimes.map((t, i) => cell(`coco · t=${t}ms`, "#67e8f9", cocoB64[i])).join("")}
  </div>
</div></body></html>`

const grid = await ctx.newPage()
await grid.setViewportSize({ width: 5200, height: 1900 })
await grid.setContent(html)
await grid.waitForLoadState("networkidle")
const gridPath = join(dir, "round-39-1-comparison-grid.png")
await grid.screenshot({ path: gridPath, fullPage: true })
console.log(`  📸 grid`, gridPath)

await browser.close()
console.log("✓ done")
