import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/produccion"); mkdirSync(dir, { recursive: true })
const B = "https://client-sites-template-five.vercel.app/"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errores = []
p.on("pageerror", e => errores.push(String(e).slice(0,120)))
await p.goto(B, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(8000)
await p.mouse.click(1305, 860); await p.waitForTimeout(1200)      // cookies
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/^MEN/i.test((e.textContent||"").trim()))?.click())
await p.waitForTimeout(6000)
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[0]?.click() })
await p.waitForTimeout(1500)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Canoa de compras/i.test(e.textContent||""))?.click())
await p.waitForTimeout(3500)
await p.screenshot({ path: join(dir, "01-canoa.png") })
const enCanoa = await p.evaluate(() => [...document.querySelectorAll("button")].map(e=>(e.textContent||"").trim()).filter(Boolean).slice(0,20))
console.log("BOTONES EN LA CANOA:", JSON.stringify(enCanoa))
console.log("errores de pagina:", errores.length ? errores : "ninguno")
await b.close()
