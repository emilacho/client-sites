/**
 * Round 48 zoom · crop the back-left island region from the 4
 * drift frames so we can see whether the 3 R44 fallen cocos
 * render visibly from the new front cam.
 */
import { chromium } from "playwright"
import { mkdirSync, readFileSync, existsSync } from "node:fs"
import { join, resolve } from "node:path"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })

const samples = [0, 8000, 16000, 24000]
const items = samples
  .map((t) => ({
    t,
    file: `round-48-drift-t${String(t).padStart(5, "0")}.png`,
  }))
  .filter((it) => existsSync(join(dir, it.file)))

if (items.length === 0) {
  console.error("no drift frames found")
  process.exit(2)
}

const b64s = items.map((it) =>
  readFileSync(join(dir, it.file)).toString("base64"),
)

// Crop window · back-left of the island.
//   sand top is the visible warm-brown polygon · the back-left
//   quadrant runs roughly:
//     left ~ 130, top ~ 320, width ~ 380, height ~ 280
const CROP = { left: 400, top: 280, width: 520, height: 360 }

const cell = (label, b64) => `
  <div style="border:1px solid #2a2a35;border-radius:8px;overflow:hidden;background:#0a0a0f;">
    <div style="padding:8px 12px;font-size:13px;font-family:ui-monospace,monospace;letter-spacing:.12em;color:#0a0a0f;background:#67e8f9;text-align:center;font-weight:700;">
      ${label}
    </div>
    <div style="width:760px;height:560px;overflow:hidden;position:relative;">
      <img src="data:image/png;base64,${b64}" style="position:absolute;left:-${CROP.left * 2}px;top:-${CROP.top * 2}px;width:${1280 * 2}px;display:block;" />
    </div>
  </div>`

const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="padding:18px;">
  <div style="font-size:16px;letter-spacing:.18em;text-transform:uppercase;color:#67e8f9;font-family:ui-monospace,monospace;margin-bottom:6px;">Round 48 · fallen cocos visibility · back-left zoom</div>
  <div style="font-size:12px;color:#a1a1aa;font-family:ui-monospace,monospace;margin-bottom:18px;">R44 fallen cocos at X=-0.95/-0.65/-0.35 · Z=-0.85/-0.65/-0.5 · Y=-0.075 · cam front [0, 4, 9] · 4 drift phases</div>
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:14px;width:fit-content;">
    ${items.map((it, i) => cell(`drift t=${(it.t / 1000).toFixed(0)}s`, b64s[i])).join("")}
  </div>
</div>
</body></html>`

const browser = await chromium.launch({ channel: "chrome", headless: true })
const ctx = await browser.newContext({
  viewport: { width: 1900, height: 1300 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
await page.setContent(html)
await page.waitForLoadState("load")
await page.screenshot({
  path: join(dir, "round-48-fallen-cocos-zoom.png"),
  fullPage: true,
})
console.log("📸 round-48-fallen-cocos-zoom.png")
await browser.close()
