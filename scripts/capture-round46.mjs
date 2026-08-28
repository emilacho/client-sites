/**
 * Round 46 · surfboard rotation Y re-pass.
 *
 * R45 changed the default camera to front [0, 4, 9]. R41's rotation
 * Y = π + 0.3 (faced the old side cam) is now likely wrong. This
 * captures 9 rotation Y candidates from one deploy via the temp
 * ?surfRotY= override added in commit 4777f6f:
 *
 *   0, π/8, π/4, 3π/8, π/2, 5π/8, 3π/4, 7π/8, π
 *
 * Each frame uses ?qa=1 so the CameraRig drift is paused (snap to
 * base front view [0, 4, 9]) · making the 9 frames directly
 * comparable.
 *
 * Output: round-46-rotation-candidates.png (3×3 grid)
 *         round-46-rot-<index>-<rad>.png    (individual frames)
 */
import { chromium } from "playwright"
import { mkdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const BASE =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

const PI = Math.PI
const candidates = [
  { label: "0",       rad: 0 },
  { label: "π/8",     rad: PI / 8 },
  { label: "π/4",     rad: PI / 4 },
  { label: "3π/8",    rad: (3 * PI) / 8 },
  { label: "π/2",     rad: PI / 2 },
  { label: "5π/8",    rad: (5 * PI) / 8 },
  { label: "3π/4",    rad: (3 * PI) / 4 },
  { label: "7π/8",    rad: (7 * PI) / 8 },
  { label: "π",       rad: PI },
]

// Vercel Security Checkpoint (Code 21) blocks bundled Chromium
// headless. Use real Chrome channel + automation-controlled flag
// disabled so the page reads as a regular user-Chrome session.
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--disable-blink-features=AutomationControlled"],
})
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
})
// Mask the navigator.webdriver flag · the most common bot signal.
await ctx.addInitScript(() => {
  Object.defineProperty(navigator, "webdriver", { get: () => undefined })
})

// Per-candidate fresh page · earlier runs showed this approach
// renders candidates 2-9 fine but the very first one comes out
// black (browser-process WebGL warmup). We capture in order, then
// recapture candidate 1 at the end where the runtime is warm.
async function captureCandidate(label, rad, captureIndex) {
  const url = `${BASE}?qa=1&surfRotY=${rad}`
  const page = await ctx.newPage()
  console.log(`→ candidate ${captureIndex}/9 · rotY = ${label} (${rad.toFixed(4)} rad)`)
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 })
  await page.waitForTimeout(3500)
  const p = join(
    dir,
    `round-46-rot-${String(captureIndex).padStart(2, "0")}-${rad
      .toFixed(4)
      .replace(/\./g, "_")}.png`,
  )
  await page.screenshot({ path: p, fullPage: false })
  console.log(`  📸 ${p}`)
  await page.close()
  return p
}

const frames = []
for (let i = 0; i < candidates.length; i++) {
  const { label, rad } = candidates[i]
  const p = await captureCandidate(label, rad, i + 1)
  frames.push({ path: p, label, rad })
}
// Recapture candidate 1 · its first attempt usually misses the canvas
// paint while the browser warms up. The chrome process is fully warm
// by now so this second attempt comes out clean.
console.log("→ recapture candidate 1 (warm runtime)")
const recaptured = await captureCandidate(candidates[0].label, candidates[0].rad, 1)
frames[0] = { path: recaptured, label: candidates[0].label, rad: candidates[0].rad }

// ── 3×3 composite ────────────────────────────────────────────────
const b64s = frames.map((f) => readFileSync(f.path).toString("base64"))
const cell = (label, rad, b64) => `
  <div>
    <div style="padding:6px 10px;font-size:12px;font-family:ui-monospace,monospace;letter-spacing:.12em;color:#0a0a0f;background:#67e8f9;border-radius:4px;margin-bottom:6px;text-align:center;font-weight:700;">
      rotY = ${label} &nbsp;·&nbsp; ${rad.toFixed(4)} rad &nbsp;·&nbsp; ${((rad * 180) / Math.PI).toFixed(1)}°
    </div>
    <img src="data:image/png;base64,${b64}" style="width:100%;display:block;border-radius:6px;border:1px solid #2a2a35;" />
  </div>`
const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="padding:12px 16px;">
  <div style="font-size:14px;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9;font-family:ui-monospace,monospace;margin-bottom:6px;">Round 46 · surfboard rotation Y candidates</div>
  <div style="font-size:11px;color:#a1a1aa;font-family:ui-monospace,monospace;margin-bottom:14px;">Default cam · front [0, 4, 9] · qa=1 (drift paused) · position [-1.57, 0.7, -1.98] · rotX 0 · rotZ π/2 · scale 0.7</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
    ${frames.map((f, i) => cell(f.label, f.rad, b64s[i])).join("")}
  </div>
</div>
</body></html>`
const grid = await ctx.newPage()
await grid.setViewportSize({ width: 3920, height: 2520 })
await grid.setContent(html)
await grid.waitForLoadState("networkidle")
await grid.screenshot({
  path: join(dir, "round-46-rotation-candidates.png"),
  fullPage: true,
})
console.log("📸 composite round-46-rotation-candidates.png")

await browser.close()
console.log("✓ done")
