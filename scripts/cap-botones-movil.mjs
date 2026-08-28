import { chromium } from "playwright"
import { resolve, join } from "node:path"
const dir = resolve("tmp/botones")
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage()
await p.goto("http://localhost:3120/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/^MEN/i.test((e.textContent||"").trim()))?.click())
await p.waitForTimeout(5000)
await p.screenshot({ path: join(dir, "movil.png") })
const m = await p.evaluate(() => {
  const b=[...document.querySelectorAll("button")]
  const f=(t)=>{const x=b.find(e=>(e.textContent||"").trim()===t); if(!x) return null; const r=x.getBoundingClientRect(); return Math.round(r.width)+'x'+Math.round(r.height)}
  const desborda = document.documentElement.scrollWidth > document.documentElement.clientWidth
  return { agregar: f("+ Agregar"), personalizar: f("+ Personalizar"), desbordaHorizontal: desborda }
})
console.log("  movil:", JSON.stringify(m))
await b.close()
