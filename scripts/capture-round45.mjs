/**
 * Round 45 · capture 6 drift-timing frames across a full ~30s
 * X/Z cycle (period 31.4s) so the elliptical hover is observable.
 * Also captures 2 drag-end frames showing the user dragging the
 * camera to a new vantage and the drift continuing from there.
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

// ── 6 drift timing frames across one full elliptical cycle ─────
{
  const page = await ctx.newPage()
  console.log("→ drift", BASE)
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
  await page.waitForTimeout(2000)
  // Drift X/Z period is 2π/0.2 ≈ 31.4s · sample 6 evenly
  const times = [0, 5000, 10000, 15000, 20000, 25000]
  const frames = []
  const startT = Date.now()
  for (let i = 0; i < times.length; i++) {
    const due = startT + times[i]
    const waitMs = Math.max(0, due - Date.now())
    if (waitMs > 0) await page.waitForTimeout(waitMs)
    const p = join(dir, `round-45-drift-t${String(times[i]).padStart(5, "0")}.png`)
    await page.screenshot({ path: p, fullPage: false })
    console.log(`  📸 drift t+${times[i]}ms`, p)
    frames.push(p)
  }

  // Compose grid
  const b64s = frames.map((p) => readFileSync(p).toString("base64"))
  const cell = (label, b64) => `
  <div>
    <div style="padding:4px 8px;font-size:10px;font-family:ui-monospace,monospace;letter-spacing:.16em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:4px;margin-bottom:4px;text-align:center;">${label}</div>
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:6px;border:1px solid #2a2a35;" />
  </div>`
  const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:8px;">
  ${times.map((t, i) => cell(`drift · t=${(t / 1000).toFixed(0)}s`, b64s[i])).join("")}
</div></body></html>`
  const grid = await ctx.newPage()
  await grid.setViewportSize({ width: 3920, height: 1700 })
  await grid.setContent(html)
  await grid.waitForLoadState("networkidle")
  await grid.screenshot({ path: join(dir, "round-45-drift-grid.png"), fullPage: true })
  console.log("  📸 grid")
  await page.close()
}

// ── drag simulation · drag from center to upper-left, release ──
{
  const page = await ctx.newPage()
  console.log("→ drag", BASE)
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
  await page.waitForTimeout(2500)
  // Pre-drag snapshot (default front view + drift)
  await page.screenshot({ path: join(dir, "round-45-drag-before.png") })
  console.log("  📸 drag pre")

  // Simulate drag · OrbitControls reads pointerdown/move/up
  const canvas = await page.$("canvas")
  if (canvas) {
    const box = await canvas.boundingBox()
    if (box) {
      const cx = box.x + box.width / 2
      const cy = box.y + box.height / 2
      // Drag from center toward upper-left to rotate view
      await page.mouse.move(cx, cy)
      await page.mouse.down()
      await page.mouse.move(cx - 200, cy - 100, { steps: 12 })
      await page.mouse.up()
      console.log("  ✓ drag executed")
    }
  }
  // Wait so drift can run from the new base position
  await page.waitForTimeout(2500)
  await page.screenshot({ path: join(dir, "round-45-drag-after-release.png") })
  console.log("  📸 drag post-release")
  await page.close()
}

await browser.close()
console.log("✓ done")
