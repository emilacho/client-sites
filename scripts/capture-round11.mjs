/**
 * Round 11 · before / after + 4-angle rotation evidence for the
 * sky restore fix.
 *
 *   node scripts/capture-round11.mjs --phase=before
 *   node scripts/capture-round11.mjs --phase=after
 *
 * Each phase captures:
 *   - round-11-${phase}.png            · qa=1 (frozen front view)
 *   - round-11-rot-${deg}-${phase}.png · no-qa · live rotation
 *
 * After-phase also composites round-11-before-after.png.
 *
 * Rotation timing · CameraRig DEGREES_PER_SECOND = 6 · side view
 * starts at angleRef=0, so 0°/90°/180°/270° = t=0/15/30/45s.
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
const framePath = join(dir, `round-11-${phase}.png`)
const comboPath = join(dir, "round-11-before-after.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})

// ── 1. qa=1 frozen front view ─────────────────────────────────────────
{
  const page = await ctx.newPage()
  const url = `${BASE}?qa=1`
  console.log("→ qa", url)
  const r = await page.goto(url, { waitUntil: "networkidle", timeout: 45_000 })
  console.log("  HTTP:", r?.status())
  await page.waitForTimeout(3000)
  await page.screenshot({ path: framePath, fullPage: false })
  console.log("  📸 frozen-front", framePath)
  await page.close()
}

// ── 2. 4-angle rotation evidence (live · no-qa) ───────────────────────
{
  const page = await ctx.newPage()
  console.log("→ rotation", BASE)
  const r = await page.goto(BASE, { waitUntil: "networkidle", timeout: 45_000 })
  console.log("  HTTP:", r?.status())
  // Wait 2s for GLBs to settle so angle 0° frame is meaningful.
  await page.waitForTimeout(2500)
  const angles = [0, 90, 180, 270]
  // Capture immediately at t≈2.5s (angle≈15° but visually = "starting side"),
  // then every 15s after the prior shot. Mark first as "0" since the
  // initial pose is the rest position.
  for (let i = 0; i < angles.length; i++) {
    const deg = angles[i]
    if (i > 0) {
      // 15s of rotation per 90°
      await page.waitForTimeout(15_000)
    }
    const rotPath = join(dir, `round-11-rot-${String(deg).padStart(3, "0")}-${phase}.png`)
    await page.screenshot({ path: rotPath, fullPage: false })
    console.log(`  📸 rot ${deg}°`, rotPath)
  }
  await page.close()
}

// ── 3. side-by-side combo (after phase only) ──────────────────────────
if (phase === "after") {
  const beforePath = join(dir, "round-11-before.png")
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
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#a78bfa;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 11 · before · black bg (fog kills GLB sky)</div>
    <img src="data:image/png;base64,${b64Before}" style="width:100%;display:block;border-radius:8px;border:1px solid #2a2a35;" />
  </div>
  <div>
    <div style="padding:6px 10px;font-size:11px;font-family:ui-monospace,monospace;letter-spacing:.18em;color:#67e8f9;text-transform:uppercase;background:#1a1a24;border-radius:6px;margin-bottom:6px;">round 11 · after · GLB sky restored</div>
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
