import { chromium } from "playwright"
import { resolve } from "node:path"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto("http://localhost:3115/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/^MEN/i.test((e.textContent||"").trim()))?.click())
await p.waitForTimeout(5000)
// 1 encebollado junior (3er + Agregar) y luego ceviche mixto
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[2]?.click() })
await p.waitForTimeout(1200)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Ceviches/i.test(e.textContent||""))?.click())
await p.waitForTimeout(2500)
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[1]?.click() })
await p.waitForTimeout(1500)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Canoa de compras/i.test(e.textContent||""))?.click())
await p.waitForTimeout(6000)
const r = await p.evaluate(() => [...document.querySelectorAll("img")].filter(i=>i.currentSrc.includes("stories")).map(i=>({
  foto: decodeURIComponent(i.currentSrc.split("url=")[1]?.split("&")[0]||""), ancho: i.naturalWidth, alto: Math.round(i.getBoundingClientRect().height) })))
console.log("FOTOS EN LA CANOA:", JSON.stringify(r))
await p.screenshot({ path: resolve("tmp/sin-patacones/canoa.png") })
await b.close()
