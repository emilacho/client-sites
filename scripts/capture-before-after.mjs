/**
 * capture-before-after · single-issue QA harness.
 *
 * Run with `--phase=before` to capture the current state of the preview.
 * Run with `--phase=after` to capture the post-fix state and combine
 * both into one side-by-side PNG ready for Supabase upload.
 *
 *   node scripts/capture-before-after.mjs --phase=before --round=3
 *   node scripts/capture-before-after.mjs --phase=after  --round=3
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
const phase = args.phase || "before" // "before" | "after"
const round = args.round || "3"
// Append `?qa=1` so the page freezes the camera + disables idle pulse
// + disables the speech bubble · screenshots become pixel-comparable
// across deploys. Pass `--no-qa` to opt out (verify default UX).
const baseUrl =
  args.url ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app"
const url = args["no-qa"] ? baseUrl : `${baseUrl}?qa=1`

const dir = resolve("scripts/qa")
mkdirSync(dir, { recursive: true })
const framePath = join(dir, `round-${round}-${phase}.png`)
const comboPath = join(dir, `round-${round}-before-after.png`)

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
console.log("→ navigating", url)
const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 })
console.log("  HTTP:", resp?.status())
// Wait for canvas + GLBs to settle. With `?qa=1` the camera is frozen
// at its initial [9, 4, 0] fov 38 angle, so this delay only covers GLB
// parsing + first paint — not rotation drift.
await page.waitForTimeout(3000)

// Frontal default camera · in qa mode this is the same fixed angle
// every run, so before/after captures are pixel-comparable.
await page.screenshot({ path: framePath, fullPage: false })
console.log("  📸", framePath)

// If we just captured "after", composite the two side-by-side
if (phase === "after") {
  const beforePath = join(dir, `round-${round}-before.png`)
  if (!existsSync(beforePath)) {
    console.error("  ✗ missing before frame at", beforePath)
    await browser.close()
    process.exit(1)
  }
  const beforeB64 = readFileSync(beforePath).toString("base64")
  const afterB64 = readFileSync(framePath).toString("base64")
  const html = `<!doctype html>
<html><body style="margin:0;background:#0a0a0f;font-family:-apple-system,system-ui,sans-serif;color:#fafafa;">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;">
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round ${round} · before</div>
    <img src="data:image/png;base64,${beforeB64}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round ${round} · after</div>
    <img src="data:image/png;base64,${afterB64}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
</div></body></html>`
  const comp = await ctx.newPage()
  await comp.setViewportSize({ width: 2580, height: 850 })
  await comp.setContent(html)
  await comp.waitForLoadState("networkidle")
  await comp.screenshot({ path: comboPath, fullPage: true })
  console.log("  📸", comboPath)
}

await browser.close()
console.log("✓ done · phase=" + phase + " · round=" + round)
