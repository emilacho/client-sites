import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const dir = resolve("tmp/ubicacion"); mkdirSync(dir, { recursive: true })
const D = "https://client-sites-template-35wx15v8w-zero-risk1.vercel.app/"
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const mapas = []
p.on("request", (r) => { const u = r.url(); if (/maps\.google|maps\/api|staticmap/.test(u)) mapas.push(u) })
await p.goto(D, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(7000)
await p.mouse.click(1305, 860); await p.waitForTimeout(1200)           // cookies
await p.mouse.click(112, 108); await p.waitForTimeout(5000)            // MENU
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[0]?.click() })
await p.waitForTimeout(1500)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/Canoa de compras/i.test(e.textContent||""))?.click())
await p.waitForTimeout(3000)
await p.evaluate(() => [...document.querySelectorAll("button")].find(e=>/PedidosYa/i.test(e.textContent||""))?.click())
await p.waitForTimeout(7000)
await p.screenshot({ path: join(dir, "mapa.png") })
// centro del mapa según el propio componente
const centro = await p.evaluate(() => {
  const g = window.google
  if (!g) return "google maps no cargó"
  return "google maps presente"
})
console.log(centro)
console.log("peticiones de mapa:", mapas.length)
for (const u of mapas.slice(0,3)) console.log("  ", u.slice(0,150))
await b.close()
