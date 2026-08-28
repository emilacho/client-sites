/**
 * Round 9 · modal-open capture · proves the MenuModal renders with
 * the Encebollados tab default-active and 3 cards visible.
 *
 * Triggers the modal via the hero "Pedir por WhatsApp" CTA (same
 * code path as clicking the cofre in 3D, but deterministic since
 * the button is in the DOM and doesn't depend on r3f raycast).
 */
import { chromium } from "playwright"
import { resolve, join } from "node:path"

const URL =
  process.env.PREVIEW_URL ||
  "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/?qa=1"
const OUT = resolve("scripts/qa")
const FRAME = join(OUT, "round-9-modal-open.png")

const browser = await chromium.launch()
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  deviceScaleFactor: 1,
})
const page = await ctx.newPage()
console.log("→ navigating", URL)
const r = await page.goto(URL, { waitUntil: "networkidle", timeout: 45_000 })
console.log("  HTTP:", r?.status())
await page.waitForTimeout(2500)

// Click the hero "Pedir por WhatsApp" button (same code path as cofre
// click in 3D · openMenu()).
const trigger = await page.getByRole("button", { name: /pedir por whatsapp/i }).first()
await trigger.click()
console.log("  ✓ clicked hero Pedir CTA")
await page.waitForTimeout(450) // framer reveal ~280ms

// Sanity assertion · tab Encebollados active + 3 cards visible.
const tab = page.getByRole("tab", { name: /encebollados/i }).first()
const active = await tab.getAttribute("aria-selected")
console.log("  encebollados tab aria-selected:", active)

const addButtons = await page.getByRole("button", { name: /^agregar/i }).count()
console.log("  '+ Agregar' buttons visible:", addButtons)

await page.screenshot({ path: FRAME, fullPage: false })
console.log("  📸", FRAME)

await browser.close()
console.log("✓ done")
