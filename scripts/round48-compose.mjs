/**
 * Round 48 · before/after composite · back-left zoom showing
 * whether the fallen cocos surface after the Y=0.06 bump.
 */
import { chromium } from "playwright"
import { readFileSync, existsSync, mkdirSync } from "node:fs"
import { join, resolve } from "node:path"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

const pairs = [16000, 24000].map((t) => {
  const tag = String(t).padStart(5, "0")
  return {
    t,
    before: `round-48-drift-t${tag}.png`,
    after: `round-48-after-drift-t${tag}.png`,
  }
})

const CROP = { left: 420, top: 320, width: 380, height: 280 }

function readB64(file) {
  const p = join(dir, file)
  return existsSync(p) ? readFileSync(p).toString("base64") : null
}

const cell = (label, b64, tone) => {
  if (!b64)
    return `<div style="padding:24px;text-align:center;font-family:ui-monospace,monospace;color:#a1a1aa;background:#0a0a0f;border:1px dashed #2a2a35;border-radius:8px;">(missing)</div>`
  const bg = tone === "before" ? "#7f1d1d" : tone === "after" ? "#14532d" : "#67e8f9"
  const fg = tone === "before" ? "#fee2e2" : tone === "after" ? "#bbf7d0" : "#0a0a0f"
  return `
  <div style="border:1px solid #2a2a35;border-radius:8px;overflow:hidden;background:#0a0a0f;">
    <div style="padding:8px 12px;font-size:12px;font-family:ui-monospace,monospace;letter-spacing:.12em;color:${fg};background:${bg};text-align:center;font-weight:700;">
      ${label}
    </div>
    <div style="width:760px;height:560px;overflow:hidden;position:relative;">
      <img src="data:image/png;base64,${b64}" style="position:absolute;left:-${CROP.left * 2}px;top:-${CROP.top * 2}px;width:${1280 * 2}px;display:block;" />
    </div>
  </div>`
}

const rows = pairs
  .map((pair) => {
    const before = readB64(pair.before)
    const after = readB64(pair.after)
    return `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
      ${cell(`BEFORE · Y = -0.075 · drift t=${(pair.t / 1000).toFixed(0)}s`, before, "before")}
      ${cell(`AFTER · Y = 0.06 · drift t=${(pair.t / 1000).toFixed(0)}s`, after, "after")}
    </div>`
  })
  .join("")

const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="padding:18px;">
  <div style="font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9;font-family:ui-monospace,monospace;margin-bottom:6px;">Round 48 · fallen cocos surface fix · back-left zoom</div>
  <div style="font-size:12px;color:#a1a1aa;font-family:ui-monospace,monospace;margin-bottom:18px;">R44 placed cocos at Y=-0.075 (buried) · R48 bumps to 0.06 (sand surface) · cam front [0, 4, 9] · live drift</div>
  ${rows}
</div>
</body></html>`

const browser = await chromium.launch({ channel: "chrome", headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1650, height: 1280 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
await page.setContent(html)
await page.waitForLoadState("load")
await page.screenshot({
  path: join(dir, "round-48-before-after.png"),
  fullPage: true,
})
console.log("📸 round-48-before-after.png")
await browser.close()
