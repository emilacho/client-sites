/**
 * Round 31 · boat wave bobbing evidence. Captures qa frozen
 * baseline (inhibition proof · suite stays comparable) plus 4
 * timing frames at t=0/1.3/2.6/3.9s during a single full cycle so
 * the boat-and-oars motion is observable across phases.
 *
 * Picked these timing offsets because the slowest component (Y bob
 * period 5.24s) is well-spread, the fastest (rot pitch 6.28s) is
 * also covered, and they sample 4 distinct visual states.
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
const framePath = join(dir, `round-31-${phase}.png`)
const comboPath = join(dir, "round-31-before-after.png")
const gridPath = join(dir, "round-31-wave-grid.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})

// qa baseline · pulse + wave both inhibited
{
  const page = await ctx.newPage()
  const url = `${BASE}?qa=1`
  console.log("→ qa", url)
  const r = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 })
  console.log("  HTTP:", r?.status())
  await page.waitForTimeout(2500)
  await page.screenshot({ path: framePath, fullPage: false })
  console.log("  📸 qa", framePath)
  await page.close()
}

// 4 live timing frames at 0 / 1.3 / 2.6 / 3.9s offsets
const times = [0, 1300, 2600, 3900]
const liveFrames = []
{
  const page = await ctx.newPage()
  console.log("→ live", BASE)
  const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 45_000 })
  console.log("  HTTP:", r?.status())
  await page.waitForTimeout(2000)
  const startT = Date.now()
  for (let i = 0; i < times.length; i++) {
    const due = startT + times[i]
    const waitMs = Math.max(0, due - Date.now())
    if (waitMs > 0) await page.waitForTimeout(waitMs)
    const p = join(dir, `round-31-wave-${phase}-t${String(times[i]).padStart(4, "0")}.png`)
    await page.screenshot({ path: p, fullPage: false })
    console.log(`  📸 ${phase} t+${times[i]}ms`, p)
    liveFrames.push(p)
  }
  await page.close()
}

if (phase === "after") {
  // 1) qa side-by-side
  const beforePath = join(dir, "round-31-before.png")
  if (existsSync(beforePath)) {
    const b64Before = readFileSync(beforePath).toString("base64")
    const b64After = readFileSync(framePath).toString("base64")
    const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;">
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 31 · before · qa frozen · no wave logic</div>
    <img src="data:image/png;base64,${b64Before}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 31 · after · qa frozen · wave inhibited (suite intact)</div>
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

  // 2) 2x4 timing grid · before row (no wave) vs after (wave)
  const beforeFrames = times.map((t) =>
    join(dir, `round-31-wave-before-t${String(t).padStart(4, "0")}.png`),
  )
  if (beforeFrames.every(existsSync)) {
    const beforeB64 = beforeFrames.map((p) => readFileSync(p).toString("base64"))
    const afterB64 = liveFrames.map((p) => readFileSync(p).toString("base64"))
    const cell = (label, color, b64) => `
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:${color};text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;text-align:center;">${label}</div>
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>`
    const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;">
  ${times.map((t, i) => cell(`Before · t=${t/1000}s · no wave`, "#a78bfa", beforeB64[i])).join("")}
  ${times.map((t, i) => cell(`After · t=${t/1000}s · wave bobbing`, "#67e8f9", afterB64[i])).join("")}
</div></body></html>`
    const grid = await ctx.newPage()
    await grid.setViewportSize({ width: 5200, height: 1700 })
    await grid.setContent(html)
    await grid.waitForLoadState("networkidle")
    await grid.screenshot({ path: gridPath, fullPage: true })
    console.log("  📸 grid", gridPath)
  }
}

await browser.close()
console.log("✓ done · phase=" + phase)
