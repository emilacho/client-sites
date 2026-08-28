import { chromium } from "playwright"
import { mkdirSync } from "node:fs"
import { resolve, join } from "node:path"
const BASE = "https://client-sites-template-git-landing-v2-zero-risk1.vercel.app/"
const dir = resolve("tmp/landing-2026-08-24"); mkdirSync(dir, { recursive: true })
const b = await chromium.launch()
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
await p.goto(BASE, { waitUntil: "networkidle", timeout: 90_000 })
await p.waitForTimeout(5000)
const shot = (n) => p.screenshot({ path: join(dir, n) })
const cl = async (x, y, esp = 2500) => { await p.mouse.click(x, y); await p.waitForTimeout(esp) }
const botones = () => p.evaluate(() => {
  const o = []
  document.querySelectorAll("button").forEach((el) => { const r = el.getBoundingClientRect()
    if (r.width > 20 && r.height > 15) o.push({ t: (el.textContent||"").trim().slice(0,32), x: Math.round(r.x+r.width/2), y: Math.round(r.y+r.height/2) }) })
  return o
})
await cl(1305, 860, 1200)                    // aceptar cookies
await cl(112, 108, 4000)                     // MENÚ
await cl(661, 525, 2500)                     // + Agregar (Encebollado Náufrago)
await shot("11-agregado.png")
await cl(996, 752, 3000)                     // Canoa de compras
await shot("20-canoa.png")
console.log("EN CANOA:", JSON.stringify((await botones()).slice(0, 20)))
