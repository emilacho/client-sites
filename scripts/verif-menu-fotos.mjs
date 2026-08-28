import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/menu-final"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 950 } })).newPage()
await p.goto("https://naufrago.ec/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(8000)
await p.mouse.click(1305, 900); await p.waitForTimeout(1200)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/^MEN/i.test((e.textContent||"").trim()))?.click())
await p.waitForTimeout(6000)
for (const [tab, file] of [["Bebidas","bebidas.png"],["Extras","extras.png"]]) {
  await p.evaluate((t) => [...document.querySelectorAll("button")].find(e=>new RegExp(t,"i").test(e.textContent||""))?.click(), tab)
  await p.waitForTimeout(5000)
  await p.screenshot({ path: join(dir, file) })
  const imgs = await p.evaluate(() => [...document.querySelectorAll("img")].filter(i=>i.currentSrc.includes("stories")).map(i=>decodeURIComponent(i.currentSrc.split("url=")[1]?.split("&")[0]||"").split("/").pop()))
  console.log(" ", tab, "->", JSON.stringify(imgs))
}
await b.close()
