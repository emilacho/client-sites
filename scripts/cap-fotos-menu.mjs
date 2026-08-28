import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/fotos-menu"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("http://localhost:3111/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(6000)
await p.mouse.click(1305, 860); await p.waitForTimeout(1200)          // cookies
// botón "Fotos del menú"
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Fotos\s*del menú/i.test(e.textContent||""))?.click())
await p.waitForTimeout(3500)
for (let i = 1; i <= 5; i++) {
  await p.screenshot({ path: join(dir, `slide-${i}.png`) })
  const t = await p.evaluate(() => {
    const h = document.querySelector("h3"); return h ? h.textContent.trim() : "?"
  })
  console.log("slide", i, "·", t)
  // siguiente
  await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Siguiente/i.test(e.getAttribute("aria-label")||""))?.click())
  await p.waitForTimeout(2000)
}
await b.close()
