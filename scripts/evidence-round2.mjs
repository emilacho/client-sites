/**
 * Evidence probe · captures 5 frames at 0/2/4/6/8s to prove the camera
 * is rotating, then clicks "Ver menú" to open MenuModal and verifies
 * all 17 items are reachable across the 5 tabs.
 */
import { chromium } from "playwright"
import { mkdirSync } from "node:fs"

const URL =
  process.argv[2] ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app"

const OUT = "scripts/round2-evidence"
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()

const errors = []
const fails = []
page.on("pageerror", (e) => errors.push(e.message))
page.on("requestfailed", (r) => fails.push(`${r.failure()?.errorText} ${r.url()}`))

console.log("→ navigating", URL)
const resp = await page.goto(URL, { waitUntil: "networkidle", timeout: 45_000 })
console.log("  HTTP:", resp?.status())

await page.waitForTimeout(2500) // canvas + GLBs load

// 5 frames over 10 seconds to prove camera rotation
const FRAME_STEPS_MS = [0, 2000, 2000, 2000, 2000] // cumulative 0/2/4/6/8s
for (let i = 0; i < FRAME_STEPS_MS.length; i++) {
  if (FRAME_STEPS_MS[i] > 0) await page.waitForTimeout(FRAME_STEPS_MS[i])
  const path = `${OUT}/frame-${i.toString().padStart(2, "0")}.png`
  await page.screenshot({ path, fullPage: false })
  console.log("  📸", path)
}

// Click "Ver menú" to open the modal
console.log("→ opening MenuModal via hero CTA")
await page.getByRole("button", { name: /Ver menú/i }).click()
await page.waitForTimeout(700)
await page.screenshot({ path: `${OUT}/menu-modal-encebollados.png`, fullPage: false })
console.log("  📸 menu-modal-encebollados.png")

// Verify tabs · click through all 5 and count items per tab
const tabLabels = ["Encebollados", "Ceviches", "Otros", "Bebidas", "Extras"]
const expectedCounts = [3, 2, 1, 6, 5]
for (let i = 0; i < tabLabels.length; i++) {
  const label = tabLabels[i]
  await page.getByRole("button", { name: new RegExp(label, "i") }).click()
  await page.waitForTimeout(250)
  const cards = await page.locator('article').count()
  const ok = cards === expectedCounts[i]
  console.log(`  ${ok ? "✓" : "✗"} ${label} · ${cards} cards (expected ${expectedCounts[i]})`)
  await page.screenshot({
    path: `${OUT}/menu-tab-${label.toLowerCase()}.png`,
    fullPage: false,
  })
}

// Close modal, then test cofre click via DOM... actually we can't easily
// click into the WebGL canvas via DOM. We just verified the modal-open
// path from the CTA. The cofre click route uses the same setMenuOpen(true).
await page.keyboard.press("Escape")
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/after-modal-close.png`, fullPage: false })

console.log("\n→ Errors during run:")
if (errors.length === 0) console.log("  (none)")
for (const e of errors) console.log("  ✗", e.slice(0, 200))

console.log("\n→ Failed requests:")
if (fails.length === 0) console.log("  (none)")
for (const f of fails) console.log("  ✗", f.slice(0, 200))

await browser.close()
console.log(`\n✓ Evidence captured · ${OUT}/`)
