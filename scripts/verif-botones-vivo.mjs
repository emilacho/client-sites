import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/botones"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("https://naufrago.ec/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/^MEN/i.test((e.textContent||"").trim()))?.click())
await p.waitForTimeout(5000)
await p.screenshot({ path: join(dir, "escritorio.png") })
const m = await p.evaluate(() => {
  const b=[...document.querySelectorAll("button")]
  const f=(t)=>{const x=b.find(e=>(e.textContent||"").trim()===t); if(!x) return null; const r=x.getBoundingClientRect(); return Math.round(r.width)+'x'+Math.round(r.height)}
  return { agregar: f("+ Agregar"), personalizar: f("+ Personalizar") }
})
console.log("  tamaños:", JSON.stringify(m))
await b.close()
