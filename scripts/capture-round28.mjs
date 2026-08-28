/**
 * Round 28 · pulse MUY visible (9% + emissive glow + cyan floor rings).
 * Captures qa frozen baseline (pulse inhibited · proves QA suite
 * stays pixel-comparable) AND 4 live-pulse timing frames per phase
 * so the new amplitude + glow + rings read across a full cycle.
 *
 *   --phase=before | after
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
const framePath = join(dir, `round-28-${phase}.png`)
const comboPath = join(dir, "round-28-before-after.png")
const gridPath = join(dir, "round-28-pulse-grid.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})

// qa=1 baseline frame
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

// live pulse timing frames
const times = [0, 1750, 3500, 5250]
const pulseFrames = []
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
    const p = join(dir, `round-28-pulse-${phase}-t${String(times[i]).padStart(4, "0")}.png`)
    await page.screenshot({ path: p, fullPage: false })
    console.log(`  📸 pulse ${phase} t+${times[i]}`, p)
    pulseFrames.push(p)
  }
  await page.close()
}

// after composites
if (phase === "after") {
  // 1) qa frozen side-by-side
  const beforeQa = join(dir, "round-28-before.png")
  if (existsSync(beforeQa)) {
    const b64Before = readFileSync(beforeQa).toString("base64")
    const b64After = readFileSync(framePath).toString("base64")
    const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;">
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 28 · before · qa frozen · pulse 6% no glow</div>
    <img src="data:image/png;base64,${b64Before}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 28 · after · qa frozen · pulse inhibited (suite intact)</div>
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

  // 2) 2x4 timing grid · before row (6% no glow no rings) vs after (9% glow rings)
  const beforeFrames = times.map((t) =>
    join(dir, `round-28-pulse-before-t${String(t).padStart(4, "0")}.png`),
  )
  if (beforeFrames.every(existsSync)) {
    const beforeB64 = beforeFrames.map((p) => readFileSync(p).toString("base64"))
    const afterB64 = pulseFrames.map((p) => readFileSync(p).toString("base64"))
    const cell = (label, color, b64) => `
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:${color};text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;text-align:center;">${label}</div>
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>`
    const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px;">
  ${times.map((t, i) => cell(`Before 6% · t=${t/1000}s`, "#a78bfa", beforeB64[i])).join("")}
  ${times.map((t, i) => cell(`After 9% + glow + rings · t=${t/1000}s`, "#67e8f9", afterB64[i])).join("")}
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
