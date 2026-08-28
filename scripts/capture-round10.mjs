/**
 * Round 10 · before/after capture for the hero text resize + blur
 * removal + width clamp.
 *
 *   node scripts/capture-round10.mjs --phase=before
 *   node scripts/capture-round10.mjs --phase=after
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
const URL =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/?qa=1"

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })
const framePath = join(dir, `round-10-${phase}.png`)
const comboPath = join(dir, "round-10-before-after.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
console.log("→", URL)
const r = await page.goto(URL, { waitUntil: "networkidle", timeout: 45_000 })
console.log("  HTTP:", r?.status())
await page.waitForTimeout(2500)
await page.screenshot({ path: framePath, fullPage: false })
console.log("  📸", framePath)

if (phase === "after") {
  const beforePath = join(dir, "round-10-before.png")
  if (!existsSync(beforePath)) {
    console.error("  ✗ missing", beforePath)
    await browser.close()
    process.exit(1)
  }
  const b64Before = readFileSync(beforePath).toString("base64")
  const b64After = readFileSync(framePath).toString("base64")
  const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;">
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 10 · before · hero big + blur</div>
    <img src="data:image/png;base64,${b64Before}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 10 · after · hero small + no blur</div>
    <img src="data:image/png;base64,${b64After}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
</div></body></html>`
  const comp = await ctx.newPage()
  await comp.setViewportSize({ width: 2580, height: 850 })
  await comp.setContent(html)
  await comp.waitForLoadState("networkidle")
  await comp.screenshot({ path: comboPath, fullPage: true })
  console.log("  📸 combo  ", comboPath)
}

await browser.close()
console.log("✓ done · phase=" + phase)
