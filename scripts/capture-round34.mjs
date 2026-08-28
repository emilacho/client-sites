/**
 * Round 34 · 8-frame timing series at 0.5s intervals across a single
 * 3.5s chest-shake cycle. Evidence: chest still then bursts ~0.4s
 * then still again; coco+palm subtle pulse continues; boat shows
 * only wave bobbing.
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
const framePath = join(dir, `round-34-${phase}.png`)
const comboPath = join(dir, "round-34-before-after.png")
const gridPath = join(dir, "round-34-timing-grid.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})

// qa baseline
{
  const page = await ctx.newPage()
  const url = `${BASE}?qa=1`
  console.log("→ qa", url)
  const r = await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 })
  console.log("  HTTP:", r?.status())
  await page.waitForTimeout(2500)
  await page.screenshot({ path: framePath, fullPage: false })
  console.log("  📸 qa", framePath)
  await page.close()
}

// 8 timing frames at 0.5s intervals (live, no qa)
const times = [0, 500, 1000, 1500, 2000, 2500, 3000, 3500]
const liveFrames = []
{
  const page = await ctx.newPage()
  console.log("→ live", BASE)
  const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 60_000 })
  console.log("  HTTP:", r?.status())
  await page.waitForTimeout(2000)
  const startT = Date.now()
  for (let i = 0; i < times.length; i++) {
    const due = startT + times[i]
    const waitMs = Math.max(0, due - Date.now())
    if (waitMs > 0) await page.waitForTimeout(waitMs)
    const p = join(dir, `round-34-t${String(times[i]).padStart(4, "0")}-${phase}.png`)
    await page.screenshot({ path: p, fullPage: false })
    console.log(`  📸 t+${times[i]}ms`, p)
    liveFrames.push(p)
  }
  await page.close()
}

if (phase === "after") {
  const beforeQa = join(dir, "round-34-before.png")
  if (existsSync(beforeQa)) {
    const b64Before = readFileSync(beforeQa).toString("base64")
    const b64After = readFileSync(framePath).toString("base64")
    const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;">
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 34 · before · uniform 9% pulse · 4 rings · all 4 targets</div>
    <img src="data:image/png;base64,${b64Before}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 34 · after · qa frozen · pulse+shake inhibited</div>
    <img src="data:image/png;base64,${b64After}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
</div></body></html>`
    const comp = await ctx.newPage()
    await comp.setViewportSize({ width: 2580, height: 850 })
    await comp.setContent(html)
    await comp.waitForLoadState("networkidle")
    await comp.screenshot({ path: comboPath, fullPage: true })
    console.log("  📸 combo", comboPath)
  }

  // 2×4 grid of the 8 after timing frames
  const b64s = liveFrames.map((p) => readFileSync(p).toString("base64"))
  const cell = (label, b64) => `
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;text-align:center;">${label}</div>
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>`
  const labels = times.map((t) => `after · t=${(t / 1000).toFixed(1)}s`)
  const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;">
  ${labels.map((l, i) => cell(l, b64s[i])).join("")}
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
