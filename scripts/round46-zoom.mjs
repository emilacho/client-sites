/**
 * Round 46 zoom · crops a tight rectangle around the surfboard
 * region from each of the 9 candidates, then stacks them 3x3 so
 * the rotation differences are easy to compare side-by-side.
 *
 * The surfboard sits at world position [-1.57, 0.7, -1.98] · with
 * the new R45 front cam at [0, 4, 9] and viewport 1280x800, an
 * empirical sweep of the captures shows it lands roughly in the
 * box (left=410, top=215, width=240, height=320) of each frame.
 */
import { chromium } from "playwright"
import { mkdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

const PI = Math.PI
const items = [
  { label: "0",    rad: 0,            file: "round-46-rot-01-0_0000.png" },
  { label: "π/8",  rad: PI / 8,       file: "round-46-rot-02-0_3927.png" },
  { label: "π/4",  rad: PI / 4,       file: "round-46-rot-03-0_7854.png" },
  { label: "3π/8", rad: (3 * PI) / 8, file: "round-46-rot-04-1_1781.png" },
  { label: "π/2",  rad: PI / 2,       file: "round-46-rot-05-1_5708.png" },
  { label: "5π/8", rad: (5 * PI) / 8, file: "round-46-rot-06-1_9635.png" },
  { label: "3π/4", rad: (3 * PI) / 4, file: "round-46-rot-07-2_3562.png" },
  { label: "7π/8", rad: (7 * PI) / 8, file: "round-46-rot-08-2_7489.png" },
  { label: "π",    rad: PI,           file: "round-46-rot-09-3_1416.png" },
]

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
})
const ctx = await browser.newContext({
  viewport: { width: 2400, height: 2400 },
  deviceScaleFactor: 1,
})

const b64s = items.map((it) =>
  readFileSync(join(dir, it.file)).toString("base64"),
)

// Crop window · surfboard sits roughly in this rectangle for all 9
//   left = 410   top = 215   width = 240   height = 320
const CROP = { left: 410, top: 215, width: 240, height: 320 }

const cell = (label, rad, b64) => `
  <div style="border:1px solid #2a2a35;border-radius:8px;overflow:hidden;background:#0a0a0f;">
    <div style="padding:8px 12px;font-size:14px;font-family:ui-monospace,monospace;letter-spacing:.12em;color:#0a0a0f;background:#67e8f9;text-align:center;font-weight:700;">
      rotY = ${label} &nbsp;·&nbsp; ${rad.toFixed(4)} rad &nbsp;·&nbsp; ${((rad * 180) / Math.PI).toFixed(1)}°
    </div>
    <div style="width:480px;height:640px;overflow:hidden;position:relative;">
      <img src="data:image/png;base64,${b64}" style="position:absolute;left:-${CROP.left * 2}px;top:-${CROP.top * 2}px;width:${1280 * 2}px;display:block;" />
    </div>
  </div>`

const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="padding:16px;">
  <div style="font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9;font-family:ui-monospace,monospace;margin-bottom:6px;">Round 46 · surfboard rotation Y · ZOOM crop</div>
  <div style="font-size:12px;color:#a1a1aa;font-family:ui-monospace,monospace;margin-bottom:16px;">Cropped from each candidate frame · same surfboard region · 2× scale · front cam [0, 4, 9] · qa=1</div>
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:14px;width:fit-content;">
    ${items.map((it, i) => cell(it.label, it.rad, b64s[i])).join("")}
  </div>
</div>
</body></html>`

const page = await ctx.newPage()
await page.setContent(html)
await page.waitForLoadState("networkidle")
await page.screenshot({
  path: join(dir, "round-46-rotation-zoom.png"),
  fullPage: true,
})
console.log("📸 zoom composite round-46-rotation-zoom.png")

await browser.close()
