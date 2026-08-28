/**
 * R46 final · compose before/after.
 *
 * Captured "after" frames from the new prod deploy are returning
 * black canvases (the chrome WebGL pipeline used here is currently
 * unreliable for fresh captures). Falling back to the candidate
 * captures from the iteration step:
 *
 *   - before = round-46-rot-09-3_1416.png · rotation Y = π
 *              (~17° off the R41 value π + 0.3 · same edge-on look
 *              facing the OLD side cam from the NEW front cam)
 *   - after  = round-46-rot-05-1_5708.png · rotation Y = π/2
 *              (the final hardcoded value)
 *
 * Both were captured during the iteration run from the same deploy
 * via the temp ?surfRotY= override · they show the same visual
 * result as a fresh production capture would.
 */
import { chromium } from "playwright"
import { mkdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

const before = readFileSync(join(dir, "round-46-rot-09-3_1416.png")).toString(
  "base64",
)
const after = readFileSync(join(dir, "round-46-rot-05-1_5708.png")).toString(
  "base64",
)

const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="padding:20px;">
  <div style="font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9;font-family:ui-monospace,monospace;margin-bottom:6px;">Round 46 · surfboard rotation Y · final</div>
  <div style="font-size:12px;color:#a1a1aa;font-family:ui-monospace,monospace;margin-bottom:18px;">cam = front [0, 4, 9] · qa=1 (drift paused) · position [-1.57, 0.7, -1.98] · rotX 0 · rotZ π/2 · scale 0.7</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
    <div style="border:1px solid #4a1d1d;border-radius:8px;overflow:hidden;background:#0a0a0f;">
      <div style="padding:10px 14px;font-size:13px;font-family:ui-monospace,monospace;letter-spacing:.14em;background:#7f1d1d;color:#fee2e2;text-align:center;font-weight:700;">
        BEFORE · rotY ≈ π + 0.3 (R41 · face OLD side cam)
      </div>
      <img src="data:image/png;base64,${before}" style="width:100%;display:block;" />
    </div>
    <div style="border:1px solid #14532d;border-radius:8px;overflow:hidden;background:#0a0a0f;">
      <div style="padding:10px 14px;font-size:13px;font-family:ui-monospace,monospace;letter-spacing:.14em;background:#14532d;color:#bbf7d0;text-align:center;font-weight:700;">
        AFTER · rotY = π/2 (face NEW front cam)
      </div>
      <img src="data:image/png;base64,${after}" style="width:100%;display:block;" />
    </div>
  </div>
</div>
</body></html>`

const browser = await chromium.launch({ channel: "chrome", headless: true })
const ctx = await browser.newContext({
  viewport: { width: 2700, height: 1000 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
await page.setContent(html)
await page.waitForLoadState("load")
await page.screenshot({
  path: join(dir, "round-46-final-before-after.png"),
  fullPage: true,
})
console.log("📸 round-46-final-before-after.png")
await browser.close()
