/**
 * Round 42 · 8-frame timing series at fine 0.15s intervals so we
 * cross at least one full 0.9s coco burst window. Cocos fire on
 * random phase offsets so we can'\''t synchronise exactly · but a
 * 1.2s span hits multiple burst phases for at least 1-2 cocos.
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
const page = await ctx.newPage()
console.log("→", BASE)
await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
await page.waitForTimeout(2000)

const times = [0, 150, 300, 450, 600, 750, 900, 1050]
const frames = []
const startT = Date.now()
for (let i = 0; i < times.length; i++) {
  const due = startT + times[i]
  const waitMs = Math.max(0, due - Date.now())
  if (waitMs > 0) await page.waitForTimeout(waitMs)
  const p = join(dir, `round-42-t${String(times[i]).padStart(4, "0")}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 t+${times[i]}ms`, p)
  frames.push(p)
}
await page.close()

// 2x4 grid
const b64s = frames.map((p) => readFileSync(p).toString("base64"))
const cell = (label, b64) => `
  <div>
    <div style="padding:4px 8px;font-size:10px;font-family:ui-monospace,monospace;letter-spacing:.16em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:4px;margin-bottom:4px;text-align:center;">${label}</div>
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:6px;border:1px solid #2a2a35;" />
  </div>`
const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;">
  ${times.map((t, i) => cell(`t=${t}ms · cocos amp 0.04 peak`, b64s[i])).join("")}
</div></body></html>`
const grid = await ctx.newPage()
await grid.setViewportSize({ width: 5200, height: 850 })
await grid.setContent(html)
await grid.waitForLoadState("networkidle")
const gridPath = join(dir, "round-42-timing-grid.png")
await grid.screenshot({ path: gridPath, fullPage: true })
console.log(`  📸 grid`, gridPath)

await browser.close()
console.log("✓ done")
