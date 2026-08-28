/**
 * Round 18 · idle pulse evidence capture.
 *
 *   --phase=before     · qa frozen baseline (no pulse yet, deployed code)
 *   --phase=after      · qa frozen + 4 pulse-cycle timing frames (live mode)
 *
 * The 4 pulse-cycle frames (after phase only) are captured WITHOUT
 * ?qa=1 so the useFrame pulse runs · the dispatch wants timings
 * 0 / 1.75 / 3.5 / 5.25 s after page load to cross a full pulse
 * cycle (duration 3.5s). Camera will drift ~6°/s during this 5.25s
 * window · acceptable for evidence.
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
const framePath = join(dir, `round-18-${phase}.png`)
const comboPath = join(dir, "round-18-before-after.png")
const pulseGridPath = join(dir, "round-18-pulse-grid-after.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})

// ── qa=1 frozen baseline ──────────────────────────────────────────────
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

// ── 4-frame pulse-cycle evidence (after phase only) ──────────────────
if (phase === "after") {
  const page = await ctx.newPage()
  console.log("→ pulse-timing", BASE)
  const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 45_000 })
  console.log("  HTTP:", r?.status())
  // Wait for GLBs + animations to settle before t=0
  await page.waitForTimeout(2000)
  // Pulse cycle 3.5s · capture at 0 / 1.75 / 3.5 / 5.25
  const times = [0, 1750, 3500, 5250]
  const frames = []
  const startT = Date.now()
  for (let i = 0; i < times.length; i++) {
    const targetMs = times[i]
    const dueAt = startT + targetMs
    const waitMs = Math.max(0, dueAt - Date.now())
    if (waitMs > 0) await page.waitForTimeout(waitMs)
    const p = join(dir, `round-18-pulse-t${String(targetMs).padStart(4, "0")}-after.png`)
    await page.screenshot({ path: p, fullPage: false })
    console.log(`  📸 t+${targetMs}ms`, p)
    frames.push(p)
  }
  await page.close()

  // Compose 2x2 grid of pulse frames
  const b64s = frames.map((p) => readFileSync(p).toString("base64"))
  const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;">
  ${["t=0 · rest","t=1.75s · peak","t=3.5s · rest","t=5.25s · peak"].map((label,i)=>`
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 18 · ${label}</div>
    <img src="data:image/png;base64,${b64s[i]}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>`).join("")}
</div></body></html>`
  const grid = await ctx.newPage()
  await grid.setViewportSize({ width: 2580, height: 1700 })
  await grid.setContent(html)
  await grid.waitForLoadState("networkidle")
  await grid.screenshot({ path: pulseGridPath, fullPage: true })
  console.log("  📸 pulse grid", pulseGridPath)
}

// ── side-by-side before/after composite (after phase only) ───────────
if (phase === "after") {
  const beforePath = join(dir, "round-18-before.png")
  if (existsSync(beforePath)) {
    const b64Before = readFileSync(beforePath).toString("base64")
    const b64After = readFileSync(framePath).toString("base64")
    const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;">
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 18 · before (qa frozen)</div>
    <img src="data:image/png;base64,${b64Before}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 18 · after (qa frozen · pulse inhibited)</div>
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
}

await browser.close()
console.log("✓ done · phase=" + phase)
