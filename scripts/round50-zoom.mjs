/**
 * Round 50 zoom · crop the back-left palm area so we can see
 * whether the repositioned surfboard now reads "in front of"
 * the trunk instead of "to the side of".
 */
import { chromium } from "playwright"
import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

// Reuse the R46 zoom region (which showed the back-left palm clearly)
const CROP = { left: 420, top: 200, width: 380, height: 420 }

const before = readFileSync(
  join(dir, "round-46-rot-05-1_5708.png"),
).toString("base64") // R46 final visual baseline at rotY=π/2 · old position
const after = existsSync(join(dir, "round-50-after-drift.png"))
  ? readFileSync(join(dir, "round-50-after-drift.png")).toString("base64")
  : null

const cell = (label, b64, tone) => {
  if (!b64)
    return `<div style="padding:24px;text-align:center;color:#a1a1aa;font-family:ui-monospace,monospace;background:#0a0a0f;border:1px dashed #2a2a35;border-radius:8px;">(missing)</div>`
  const bg = tone === "before" ? "#7f1d1d" : "#14532d"
  const fg = tone === "before" ? "#fee2e2" : "#bbf7d0"
  return `
  <div style="border:1px solid #2a2a35;border-radius:8px;overflow:hidden;background:#0a0a0f;">
    <div style="padding:8px 12px;font-size:13px;font-family:ui-monospace,monospace;letter-spacing:.12em;color:${fg};background:${bg};text-align:center;font-weight:700;">
      ${label}
    </div>
    <div style="width:760px;height:840px;overflow:hidden;position:relative;">
      <img src="data:image/png;base64,${b64}" style="position:absolute;left:-${CROP.left * 2}px;top:-${CROP.top * 2}px;width:${1280 * 2}px;display:block;" />
    </div>
  </div>`
}

const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="padding:18px;">
  <div style="font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9;font-family:ui-monospace,monospace;margin-bottom:6px;">Round 50 · surfboard "in front of" trunk · back-palm zoom</div>
  <div style="font-size:12px;color:#a1a1aa;font-family:ui-monospace,monospace;margin-bottom:18px;">Before · X=-1.57, Z=-1.98 (next to trunk) · After · X=-1.307, Z=-1.7 (in front of trunk)</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;width:fit-content;">
    ${cell("BEFORE · X=-1.57, Z=-1.98 · side of trunk", before, "before")}
    ${cell("AFTER · X=-1.307, Z=-1.7 · front of trunk", after, "after")}
  </div>
</div>
</body></html>`

const browser = await chromium.launch({ channel: "chrome", headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1620, height: 1000 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
await page.setContent(html)
await page.waitForLoadState("load")
await page.screenshot({
  path: join(dir, "round-50-before-after.png"),
  fullPage: true,
})
console.log("📸 round-50-before-after.png")
await browser.close()
