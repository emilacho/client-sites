/**
 * Round 23 · pulse amplitude evidence. Captures 4 timing frames per
 * phase (no ?qa=1 so the pulse actually runs) and composes an
 * 8-frame 2x4 grid for direct visual comparison.
 *
 *   --phase=before
 *   --phase=after
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
const BASE =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })
const gridPath = join(dir, "round-23-pulse-grid.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})

// Capture 4 timing frames at t=0/1.75/3.5/5.25s from page-settle
const page = await ctx.newPage()
console.log("→", BASE)
const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 45_000 })
console.log("  HTTP:", r?.status())
await page.waitForTimeout(2000)
const times = [0, 1750, 3500, 5250]
const startT = Date.now()
const frames = []
for (let i = 0; i < times.length; i++) {
  const due = startT + times[i]
  const waitMs = Math.max(0, due - Date.now())
  if (waitMs > 0) await page.waitForTimeout(waitMs)
  const p = join(dir, `round-23-${phase}-t${String(times[i]).padStart(4, "0")}.png`)
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 ${phase} t+${times[i]}ms`, p)
  frames.push(p)
}
await page.close()

// On after, compose 2x4 grid (before row + after row)
if (phase === "after") {
  const beforeFrames = times.map((t) =>
    join(dir, `round-23-before-t${String(t).padStart(4, "0")}.png`),
  )
  if (!beforeFrames.every(existsSync)) {
    console.error("  ✗ missing before frames")
    await browser.close()
    process.exit(1)
  }
  const beforeB64 = beforeFrames.map((p) => readFileSync(p).toString("base64"))
  const afterB64 = frames.map((p) => readFileSync(p).toString("base64"))
  const headerCell = (label, color) =>
    `<div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:${color};text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;text-align:center;">${label}</div>`
  const imgCell = (b64) =>
    `<img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />`
  const cell = (label, color, b64) =>
    `<div>${headerCell(label, color)}${imgCell(b64)}</div>`
  const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;">
  ${times.map((t, i) => cell(`Before 3% · t=${t / 1000}s`, "#a78bfa", beforeB64[i])).join("")}
  ${times.map((t, i) => cell(`After 6% · t=${t / 1000}s`, "#67e8f9", afterB64[i])).join("")}
</div></body></html>`
  const grid = await ctx.newPage()
  await grid.setViewportSize({ width: 5200, height: 1700 })
  await grid.setContent(html)
  await grid.waitForLoadState("networkidle")
  await grid.screenshot({ path: gridPath, fullPage: true })
  console.log("  📸 grid", gridPath)
}

await browser.close()
console.log("✓ done · phase=" + phase)
