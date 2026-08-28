import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/carta"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
p.on("pageerror", e => console.log("EXC:", String(e).slice(0,120)))
await p.goto("http://localhost:3113/", { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(9000)
const clicTexto = (re) => p.evaluate((r) => {
  const b=[...document.querySelectorAll("button")].find(e=>new RegExp(r,"i").test(e.textContent||""))
  if(!b) return "no está"; b.click(); return "ok"
}, re.source ?? re)
console.log("MENU:", await clicTexto("^MEN"))
await p.waitForTimeout(4500)
await p.screenshot({ path: join(dir, "01-encebollados.png") })
console.log("Ceviches:", await clicTexto("Ceviches")); await p.waitForTimeout(2500)
await p.screenshot({ path: join(dir, "02-ceviches.png") })
console.log("Bebidas:", await clicTexto("Bebidas")); await p.waitForTimeout(2500)
await p.screenshot({ path: join(dir, "03-bebidas.png") })
console.log("Otros:", await clicTexto("Otros")); await p.waitForTimeout(2500)
await p.screenshot({ path: join(dir, "04-otros.png") })
// volver a encebollados, agregar 2, abrir canoa
await clicTexto("Encebollados"); await p.waitForTimeout(2000)
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[0]?.click() })
await p.waitForTimeout(1500)
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[1]?.click() })
await p.waitForTimeout(1500)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Canoa de compras/i.test(e.textContent||""))?.click())
await p.waitForTimeout(3500)
await p.screenshot({ path: join(dir, "10-canoa.png") })
await b.close()
console.log("listo")
