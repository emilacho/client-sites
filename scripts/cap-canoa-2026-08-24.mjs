import { chromium } from "playwright"
import { resolve, join } from "node:path"
const BASE = "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const dir = resolve("tmp/landing-2026-08-24")
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(5000)
await p.mouse.click(1305, 860); await p.waitForTimeout(1000)
await p.mouse.click(112, 108); await p.waitForTimeout(4500)
// agregar 1 encebollado + 1 ceviche
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[0]?.click() })
await p.waitForTimeout(1500)
await p.evaluate(() => { const b=[...document.querySelectorAll("button")].filter(e=>(e.textContent||"").trim()==="+ Agregar"); b[1]?.click() })
await p.waitForTimeout(1500)
// abrir canoa desde el pie del menú
await p.evaluate(() => { [...document.querySelectorAll("button")].find(e=>/Canoa de compras/i.test(e.textContent||""))?.click() })
await p.waitForTimeout(3500)
await p.screenshot({ path: join(dir, "20-canoa.png") })
const bs = await p.evaluate(() => [...document.querySelectorAll("button")].map(e=>(e.textContent||"").trim().slice(0,34)).filter(Boolean))
console.log("BOTONES EN CANOA:", JSON.stringify(bs.slice(0, 24)))
// intentar avanzar al pago
await p.evaluate(() => { [...document.querySelectorAll("button")].find(e=>/pagar|continuar|finalizar|siguiente|pedido/i.test(e.textContent||""))?.click() })
await p.waitForTimeout(3500)
await p.screenshot({ path: join(dir, "21-pago.png") })
console.log("BOTONES DESPUES:", JSON.stringify((await p.evaluate(() => [...document.querySelectorAll("button")].map(e=>(e.textContent||"").trim().slice(0,30)).filter(Boolean))).slice(0,24)))
await b.close()
